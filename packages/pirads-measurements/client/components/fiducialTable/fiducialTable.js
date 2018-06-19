import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';
import { OHIF } from 'meteor/ohif:core';
import { cornerstoneTools } from 'meteor/ohif:cornerstone';
import { ReactiveVar } from 'meteor/reactive-var'
import { $ } from 'meteor/jquery';
import { bindToMeasurementAdded } from '../../lib/customCommands.js'

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

function descriptionMap(seriesDescription) {
    if (seriesDescription.includes('t2_tse_tra')) {
        return 'tra';
    }
    else if (seriesDescription.includes('_ADC')) {
        return 'adc';
    }
    else if (seriesDescription.includes('_BVAL')) {
        return 'hbval';
    }
    else if (seriesDescription.includes('KTrans')) {
        return 'ktrans';
    }
}

async function displayFiducials(instance) {

  // OHIF.viewerbase.toolManager.setActiveTool('probe');
  $('#probe').trigger("click");
  await wait(1);

  const studyInstanceUid = OHIF.viewerbase.layoutManager.viewportData[Session.get('activeViewport')]['studyInstanceUid'];
  const patientName = instance.data.studies[0].patientName;
  const fiducials = Fiducials.find({ ProxID: patientName }).fetch();
  const delay = 2000;
  // const element = $('.imageViewerViewport')[Session.get('activeViewport')];
  // const image = cornerstone.getEnabledElement(element).image;
  // const imagePlane = cornerstone.metaData.get('imagePlaneModule', image.imageId);
  // console.log(imagePlane);
  // const sliceThickness = cornerstone.metaData.get('instance', image.imageId)['sliceThickness'];
  $('.imageViewerViewport').each((ind, ele) => {
      const imageId = cornerstone.getEnabledElement(ele).image.imageId;
      const seriesDescription = cornerstone.metaData.get('series', imageId)['seriesDescription'];
      fiducials.forEach(async (val, index) => {
          const imagePoint = val[descriptionMap(seriesDescription)];
          // const flag = true
          // const imagaIndex = (flag) ? (cornerstone.metaData.get('series', imageId).numImages - imagePoint.z) : (imagePoint.z);
          // console.log(cornerstone.metaData.get('series', imageId).numImages);
          const imagaIndex = cornerstone.metaData.get('series', imageId).numImages - imagePoint.z - 1;
          function scroll() {
            return new Promise(resolve => {
              setTimeout(() => {
                cornerstoneTools.scrollToIndex(ele, imagaIndex);
                resolve('resolved');
              }, delay * (index + 1));
            });
          }

          const measurementData = {
            'f_id': val.fid,
            'ClinSig': val.ClinSig,
            'server': true,
            'visible': true,
            'active': true,
            'color': (val.ClinSig) ? '#ee6002' : '#90ee02',
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
          await scroll();
          await wait((delay/2) * (index + 1));
          $(ele).off('cornerstonetoolsmeasurementadded');
          cornerstoneTools.addToolState(ele, 'probe', measurementData);
          cornerstone.updateImage(ele);
          bindToMeasurementAdded(ele);
      });
  });

  // await wait(1);
  // $('#probe').trigger("click");

  // console.log(cornerstone.metaData.get('instance', image.imageId));
  // console.log(imagePlane.imagePositionPatient.z);

  // fiducials.forEach(async (val, index) => {
    // console.log(val.pos.z);
    // const imagaIndex = Math.floor(Math.abs(imagePlane.imagePositionPatient.z - val.pos.z)/sliceThickness) - 2;
    // const seriesDescription = cornerstone.metaData.get('series', image.imageId);



    // const delay = 1000;
    //
    // function scroll() {
    //   return new Promise(resolve => {
    //     setTimeout(() => {
    //       cornerstoneTools.scrollToIndex(element, imagaIndex);
    //       resolve('resolved');
    //     }, delay * (index + 1));
    //   });
    // }
    //
    // await scroll();
    // await wait((delay/2) * (index + 1));

    // console.log(imagaIndex);
    // const patientPoint = new cornerstoneMath.Vector3(val.pos.x, val.pos.y, val.pos.z);
    //
    // const imagePoint = cornerstoneTools.projectPatientPointToImagePlane(patientPoint, imagePlane);
    // const measurementData = {
    //   'f_id': val.fid,
    //   'ClinSig': val.ClinSig,
    //   'server': true,
    //   'visible': true,
    //   'active': true,
    //   'color': (val.ClinSig) ? '#ee6002' : '#90ee02',
    //   'invalidated': true,
    //   'handles': {
    //     'end': {
    //       'active': true,
    //       'highlight': true,
    //       'x': imagePoint.x,
    //       'y': imagePoint.y
    //     }
    //   }
    // };
    // cornerstoneTools.addToolState(element, 'probe', measurementData);
  // });

  $('#feedback-button').addClass('disabled');
  $('#feedback-button').removeClass('js-save');

  function findingsAnalysis() {

    let str = '';

    fiducials.forEach((val) => {
      const minDistance = Number.MAX_SAFE_INTEGER;
      const f_id = 0;
      const patientPoint = new cornerstoneMath.Vector3(val.pos.x, val.pos.y, val.pos.z);
      fiducialsCollection.find({'studyInstanceUid': studyInstanceUid}).fetch().forEach((value) => {
          const distance = patientPoint.distanceTo(value.patientPoint).toFixed(2)
          if (distance < minDistance) {
            minDistance = distance;
            f_id = value.id;
          }
      });
      if (f_id) {
        str = str.concat(
          'fid '+ f_id + ' is closest to ',
          (val.ClinSig) ? 'CSPC-' + val.fid : 'CIPC-' + val.fid,
          ' with ' + minDistance + ' mm\n'
        );
      }
    });

    return str;
  }

  const ClinSigCounter = fiducials.filter(v => v.ClinSig).length;

  instance.feedbackString.set(''.concat(
    'An expert radiologist indicated ',
    fiducials.length.toString(),
    (fiducials.length === 1) ? ' area ' : ' areas ',
    'of suspicion for this patient, and the patient underwent MR-guidance biopsies.\n\n',
    'Biopsy results:\n',
    ClinSigCounter,
    ' clinical significant',
    (ClinSigCounter === 1) ? ' finding ' : ' findings ',
    '(Gleason score 7 or higher) were identified by a pathologist.\n\n',
    'Analysis of your findings:\n',
    findingsAnalysis(),
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
