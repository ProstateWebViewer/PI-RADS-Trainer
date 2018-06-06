import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';
import { OHIF } from 'meteor/ohif:core';
import { cornerstoneTools } from 'meteor/ohif:cornerstone';
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
  Meteor.subscribe('fiducials.public');
});

Template.fiducialTable.helpers({
  fiducials() {
    const studyInstanceUid = window.location.pathname.split('/')[2];
    return fiducialsCollection.find({'studyInstanceUid': studyInstanceUid}).fetch();
  },

  prostateLabels() {
    return prostateLabels;
  }
});

Template.fiducialTable.events({
  'click .js-save'(event, instance) {
    patientName = instance.data.studies[0].patientName
    //OHIF.ui.showDialog('feedbackModal');
    // displayGroundTruth(instance);
    const fiducials = Fiducials.find({ ProxID: patientName }).fetch();
    const element = $('.imageViewerViewport')[0];
    const image = cornerstone.getEnabledElement(element).image;
    const imagePlane = cornerstone.metaData.get('imagePlaneModule', image.imageId);

    fiducials.forEach((val) => {
      let patientPoint = new cornerstoneMath.Vector3(val.pos.x, val.pos.y, val.pos.z);
      const imagePoint = cornerstoneTools.projectPatientPointToImagePlane(patientPoint, imagePlane);
      const probe = {
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
      }
      // console.log(probe);
      cornerstoneTools.addToolState(element, 'probe', probe);
    });
    //
    // console.log(fiducial);
  }
});
