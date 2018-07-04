import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';
import { Tracker } from 'meteor/tracker';
import { ReactiveVar } from 'meteor/reactive-var';
import { _ } from 'meteor/underscore';
import { OHIF } from 'meteor/ohif:core';
import { cornerstoneTools } from 'meteor/ohif:cornerstone';
import { $ } from 'meteor/jquery';
import { Mongo } from 'meteor/mongo';
import { bindToMeasurementAdded } from '../../../lib/customCommands.js'

Fiducials = new Mongo.Collection('fiducials');

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
  // const currentTool = OHIF.viewerbase.toolManager.getActiveTool();
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
    '(Gleason score 7 or higher) ',
    (ClinSigCounter === 1) ? 'was ' : 'were ',
    'identified in the pathology report.\n\n',
    'Analysis of your findings:\n',
    findingsAnalysis(),
  ));
  // alert(fiducials.length.toString() + ' locations were biopsied.');
  $('#wwwc').trigger("click");
}

Template.measurementTableView.onCreated(() => {
  const instance = Template.instance();
  instance.feedbackString = new ReactiveVar('');
  instance.feedbackActive = new ReactiveVar(true);
  instance.disableReport = new ReactiveVar(false);
  Meteor.subscribe('fiducials.public');
});

Template.measurementTableView.helpers({
  fiducials() {
    const studyInstanceUid = window.location.pathname.split('/')[2];
    return fiducialsCollection.find({'studyInstanceUid': studyInstanceUid}).fetch();
  },

  prostateLabels() {
    return prostateLabels;
  },

  getFeedback() {
    return Template.instance().feedbackString.get();
  },

  isFeedbackActive() {
    return Template.instance().feedbackActive.get();
  },

  isReportDisabled() {
    return Template.instance().disableReport.get();
  }

});

Template.measurementTableView.events({
  'click .js-getFeedback'(event, instance) {
      instance.disableReport.set(true);
      $('.roundedButtonWrapper[data-value="result"]').removeClass('disabled');
      $('.roundedButtonWrapper[data-value="result"]').click();
      instance.feedbackActive.set(false);

      $('.roundedButtonWrapper[data-value="findings"]').on('click', (eve) => {
          instance.feedbackActive.set(true);
      });
      $('.roundedButtonWrapper[data-value="result"]').on('click', (eve) => {
          instance.feedbackActive.set(false);
      });

      displayFiducials(instance);
  }

});
