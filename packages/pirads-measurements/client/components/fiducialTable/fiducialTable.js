import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';
import { OHIF } from 'meteor/ohif:core';
import { cornerstoneTools } from 'meteor/ohif:cornerstone';
import { ReactiveVar } from 'meteor/reactive-var'
import { $ } from 'meteor/jquery';
import '../../lib/customCommands.js'

Fiducials = new Mongo.Collection('fiducials');

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


function getImageId() {
  var closest;
  imageIds.forEach(function(imageId) {
    var imagePlane = cornerstone.metaData.get('imagePlaneModule', imageId);
    var imgPosZ = imagePlane.imagePositionPatient[2];
    var distance = Math.abs(imgPosZ - imagePositionZ);
    if (distance < minDistance) {
      minDistance = distance;
      closest = imageId;
    }
  });

  return closest;
}

function wait(ms) {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve('resolved');
    }, ms);
  });
}

async function displayFiducials(instance) {
  $('#probe').trigger("click");
  await wait(1);

  const patientName = instance.data.studies[0].patientName;
  const fiducials = Fiducials.find({ ProxID: patientName }).fetch();
  const element = $('.imageViewerViewport')[Session.get('activeViewport')];
  const image = cornerstone.getEnabledElement(element).image;
  const imagePlane = cornerstone.metaData.get('imagePlaneModule', image.imageId);
  const sliceThickness = cornerstone.metaData.get('instance', image.imageId)['sliceThickness'];

  // console.log(cornerstone.metaData.get('instance', image.imageId));
  // console.log(imagePlane.imagePositionPatient.z);

  fiducials.forEach(async (val, index) => {
    // console.log(val.pos.z);
    const imagaIndex = Math.floor(Math.abs(imagePlane.imagePositionPatient.z - val.pos.z)/sliceThickness) - 2;
    const delay = 500;

    function scroll() {
      return new Promise(resolve => {
        setTimeout(() => {
          cornerstoneTools.scrollToIndex(element, imagaIndex);
          resolve('resolved');
        }, delay * (index + 1));
      });
    }

    await scroll();
    await wait((delay/2) * (index + 1));

    // console.log(imagaIndex);
    const patientPoint = new cornerstoneMath.Vector3(val.pos.x, val.pos.y, val.pos.z);

    const studyInstanceUid = OHIF.viewerbase.layoutManager.viewportData[Session.get('activeViewport')]['studyInstanceUid'];
    fiducialsCollection.find({'studyInstanceUid': studyInstanceUid}).fetch().forEach((value) => {
        console.log(patientPoint.distanceTo(value.patientPoint));
    });

    const imagePoint = cornerstoneTools.projectPatientPointToImagePlane(patientPoint, imagePlane);
    const probe = {
      'f_id': val.fid,
      'server': true,
      'visible': true,
      'active': true,
      'color': 'red',
      'invalidated': true,
      'handles': {
        'end': {
          'active': true,
          'highlight': true,
          'x': imagePoint.x,
          'y': imagePoint.y
        }
      }
    };
    cornerstoneTools.addToolState(element, 'probe', probe);
  });

  $('#feedback-button').addClass('disabled');
  $('#feedback-button').removeClass('js-save');

  const ClinSigCounter = fiducials.filter(v => !v.ClinSig).length;

  instance.feedbackString.set(fiducials.length.toString().concat(
    (fiducials.length === 1) ? ' location was biopsied.' : ' locations were biopsied.',
    '\n',
    'With ' + ClinSigCounter + ' clinical significance.',
    '\n\n',
    (ClinSigCounter === 0) ? '' : 'From your fiducials:\n fiducial 1 is closest to cs1.\n\n\n\n\n\n\n\n\n\n lol',
  ));
  // alert(fiducials.length.toString() + ' locations were biopsied.');

}

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
  instance.feedbackString = new ReactiveVar('');
  Meteor.subscribe('fiducials.public');
});

Template.fiducialTable.helpers({
  fiducials() {
    const studyInstanceUid = window.location.pathname.split('/')[2];
    return fiducialsCollection.find({'studyInstanceUid': studyInstanceUid}).fetch();
  },

  prostateLabels() {
    return prostateLabels;
  },

  getFeedback() {
    return Template.instance().feedbackString.get();
  }
});

Template.fiducialTable.events({
  'click .js-save'(event, instance) {
    //OHIF.ui.showDialog('feedbackModal');
    // displayGroundTruth(instance);
    displayFiducials(instance);
  }
});
