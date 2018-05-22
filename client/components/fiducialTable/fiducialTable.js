import { Template } from 'meteor/templating';
import { OHIF } from 'meteor/ohif:core';
import { Mongo } from 'meteor/mongo';
import { cornerstoneTools } from 'meteor/ohif:cornerstone'
import { $ } from 'meteor/jquery';

fiducials = new Mongo.Collection('fiducials', {connection: null});
let counter = 0;

!function(t,n,i){var a={},e=function(t){a[t]&&(n.clearInterval(a[t]),a[t]=null)},r="waitUntilExists.found";t.fn.waitUntilExists=function(i,o,l){var s=this.selector,u=t(s),c=u.not(function(){return t(this).data(r)});return"remove"===i?e(s):(c.each(i).data(r,!0),o&&u.length?e(s):l||(a[s]=n.setInterval(function(){u.waitUntilExists(i,o,!0)},500))),u}}(window.jQuery,window);

function addFiducialData(element, data) {
    counter++;
    fiducials.insert({'measurementNumber': counter, 'data': data, '_id': counter.toString(), 'x': Math.round(data.handles.end.x), 'y': Math.round(data.handles.end.y)});
}

function removeFiducialData(element, data) {
    counter = 0;
    fiducials.remove({});
    fiducialArray = cornerstoneTools.globalImageIdSpecificToolStateManager.get(element, 'probe')['data'].forEach((val) => {
        addFiducialData(element, val);
    });
}

$('.imageViewerViewport').waitUntilExists((index, element) => {
    element.addEventListener('cornerstonemeasurementremoved', (ev) => {
        if (ev.detail.toolType === 'probe') {
            removeFiducialData(ev.target, ev.detail.measurementData);
        }
    });
    element.addEventListener('cornerstonetoolsmeasurementadded', (ev) => {
        if (ev.detail.toolType === 'probe') {
            addFiducialData(ev.target, ev.detail.measurementData);
        }
    });
    element.addEventListener('cornerstonetoolsmeasurementmodified', (ev) => {
        if (ev.detail.toolType === 'probe') {
            $(this).off('mouseup').one('mouseup', () => {
                removeFiducialData(ev.target, ev.detail.measurementData);
            });
        }
    });
})

// Add fiducial data to the list
// function addFiducialToList(element) {
//     fiducialArray = cornerstoneTools.globalImageIdSpecificToolStateManager.get(element, 'probe')['data'];
//     fiducialArrayLength = fiducialArray.length;
//     if (fiducialArrayLength) {
//         try {
//             fiducials.insert({'measurementNumber': fiducialArrayLength, 'data': fiducialArray[fiducialArrayLength - 1], '_id': fiducialArrayLength.toString()});
//         } catch (error) {
//             return;
//         }
//     }
// }

// Listen to click event when fiducial tool is used
// document.addEventListener('click', (ev) => {
//     if (ev.target.localName === 'canvas') {
//       const activeTool = OHIF.viewerbase.toolManager.getActiveTool();
//       if (activeTool === 'probe') {
//           addFiducialToList(ev.target.parentElement);
//       }
//     }
// });

var zoneDecoder = function (sectorName)
{
  var zones = {
    "peripheral": false,
    "transitional": false,
    "central": false,
    "urethra": false,
    "seminal": false
  };
  switch (true) {
    case sectorName.toUpperCase().startsWith('P'):
      zones["peripheral"]= true;
      break;
    case sectorName.toUpperCase().startsWith('T'):
      zones["transitional"]= true;
      break;
    case sectorName.toUpperCase().startsWith('C'):
      zones["central"]= true;
      break;
    case sectorName.toUpperCase().startsWith('S'):
      zones["seminal"]= true;
      break;
    case sectorName.toUpperCase().startsWith('U'):
      zones["urethra"]= true;
      break;
  }

  return zones;
};

const list = {
  "seminal vesicles":{
    "L":["SV"],
    "R":["SV"]
  },
  "urethra":"urethra",
  "base":{
    "L":["AS","TZa","PZa","TZp","CZ","PZpl"],
    "R":["AS","TZa","PZa","TZp","CZ","PZpl"]
  },
  "mid":{
    "L":["AS","TZa","PZa","TZp","PZpm","PZpl"],
    "R":["AS","TZa","PZa","TZp","PZpm","PZpl"]
  },
  "apex":{
    "L":["AS","TZa","PZa","TZp","PZpm","PZpl"],
    "R":["AS","TZa","PZa","TZp","PZpm","PZpl"]

  }
};

const prostateLabels = ["AS","TZa","PZa","TZp","PZpm","PZpl", "SV", "CZ", "Urethra"];


function displayGroundTruth() {
  OHIF.viewer.pathologyInfo.find().forEach(info => {
    const patientPoint = new cornerstoneMath.Vector3(
      info.pos_rsa[0],
      info.pos_rsa[1],
      info.pos_rsa[2]
    );

    const study = OHIF.viewer.Studies.all()[0];
    const displaySet = study.displaySets.find(a => a.seriesDescription === "t2_tse_tra");
    if (!displaySet) {
      return;
    }

    let min = Number.MAX_VALUE;
    let closestIndex = 0;
    displaySet.images.forEach((image, index) => {
      if (image.numberOfFrames && parseInt(image.numberOfFrames, 10) !== 1) {
        return;
      }

      const imagePlane = cornerstone.metaData.get('imagePlane', image.getImageId());
      if (!imagePlane) {
        return;
      }

      const distance = cornerstoneMath.point.distance(patientPoint, imagePlane.imagePositionPatient);
      if (distance < min) {
        min = distance;
        closestIndex = index;
      }
    });

    const image = displaySet.images[closestIndex];
    const imagePlane = cornerstone.metaData.get('imagePlane', image.getImageId());
    const imagePoint = cornerstoneTools.projectPatientPointToImagePlane(patientPoint, imagePlane);

    const imageId = image.getImageId();
    const toolState = cornerstoneTools.globalImageIdSpecificToolStateManager.saveToolState()

    if (!toolState[imageId]) {
      toolState[imageId] = {};
    }

    if (!toolState[imageId]['fiducialResults']) {
      toolState[imageId]['fiducialResults'] = {
        data: [{
          handles: {
            end: {
              x: imagePoint.x,
              y: imagePoint.y
            }
          },
          color: info.ClinSig ? 'green' : 'red'
        }]
      };
    } else {
      toolState[imageId]['fiducialResults'].data.push({
        handles: {
          end: {
            x: imagePoint.x,
            y: imagePoint.y
          }
        },
        color: info.ClinSig ? 'green' : 'red'
      });
    }

    cornerstoneTools.globalImageIdSpecificToolStateManager.restoreToolState(toolState);

    cornerstone.getEnabledElements().forEach(enabledElement => {
      cornerstone.updateImage(enabledElement.element, true);
    });
  });
}

Template.fiducialTable.onCreated(() => {
  const instance = Template.instance();

});

Template.fiducialTable.helpers({
  fiducials() {
    return fiducials.find().fetch();
  },

  prostateLabels() {
    return prostateLabels;
  }
});

Template.fiducialTable.events({
  'click .js-save'(event, instance) {
    //OHIF.ui.showDialog('feedbackModal');
    displayGroundTruth(instance);
  }
});
