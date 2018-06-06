import { Mongo } from 'meteor/mongo';
import { cornerstoneTools, cornerstone } from 'meteor/ohif:cornerstone'
import { $ } from 'meteor/jquery';
import { waitUntilExists } from 'jquery.waituntilexists'


fiducialsCollection = new Mongo.Collection('fiducialsCollection', {connection: null});
const probeSynchronizer = new cornerstoneTools.Synchronizer('cornerstonenewimage', cornerstoneTools.stackImagePositionSynchronizer);
let fiducialCounter = 0;


function getPatientPoint(imagePoint, element) {
    const image = cornerstone.getEnabledElement(element).image;
    const imagePlane = cornerstone.metaData.get('imagePlaneModule', image.imageId);

    return cornerstoneTools.imagePointToPatientPoint(imagePoint, imagePlane);
}


function getImagePoint(patientPoint, element) {
    const image = cornerstone.getEnabledElement(element).image;
    const imagePlane = cornerstone.metaData.get('imagePlaneModule', image.imageId);

    return cornerstoneTools.projectPatientPointToImagePlane(patientPoint, imagePlane);
}

function isInBoundary(element, coords) {
    const image = cornerstone.getEnabledElement(element).image;
    const width = image.width;
    const height = image.height;
    return 0 <= coords.x && coords.x <= width && coords.y <= height && 0 <= coords.y;
}

// TODO: clean and comment for all the functions
function addFiducial(element, measurementData) {
    fiducialCounter++;
    const studyInstanceUid = OHIF.viewerbase.layoutManager.viewportData[Session.get('activeViewport')]['studyInstanceUid'];

    cornerstoneTools.removeToolState(element, 'probe', measurementData);
    cornerstone.updateImage(element);

    const patientPoint = getPatientPoint(measurementData.handles.end, element);
    console.log(measurementData);
    let imageIds = [];

    $('.imageViewerViewport').each((index, ele) => {
        let elementSpecificMeasurementData = $.extend(true, {}, measurementData);
        const imagePoint = getImagePoint(patientPoint, ele);
        elementSpecificMeasurementData.handles.end.x = imagePoint.x;
        elementSpecificMeasurementData.handles.end.y = imagePoint.y;
        elementSpecificMeasurementData.id = fiducialCounter;
        elementSpecificMeasurementData.active = false;

        if (isInBoundary(ele, elementSpecificMeasurementData.handles.end)) {
          $(ele).off('cornerstonetoolsmeasurementadded');
          cornerstoneTools.addToolState(ele, 'probe', elementSpecificMeasurementData);
          cornerstone.updateImage(ele);
          bindToMeasurementAdded(ele);

          imageIds.push(cornerstone.getEnabledElement(ele).image.imageId);
        }
    });

    let fiducial = {
      'id': fiducialCounter,
      'studyInstanceUid': studyInstanceUid,
      'imageIds': imageIds,
      'patientPoint': patientPoint
    }

    fiducialsCollection.insert(fiducial);
}


function removeFiducial(element, measurementData) {
    if (measurementData.hasOwnProperty('id')) {
        $('.imageViewerViewport').each((index, ele) => {
            const toolData = cornerstoneTools.getElementToolStateManager(ele).get(ele, 'probe');

            for (let i = 0; i < toolData.data.length; i++) {
                if (toolData.data[i].id === measurementData.id) {
                    toolData.data.splice(i, 1);
                }
            }

            cornerstone.updateImage(ele);
        });
        fiducialsCollection.remove({ 'id': measurementData.id });
    }
}


function modifyFiducial(element, measurementData) {
    const patientPoint = getPatientPoint(measurementData.handles.end, element);

    $('.imageViewerViewport').each((index, ele) => {
        if (ele !== element) {
            const toolData = cornerstoneTools.getElementToolStateManager(ele).get(ele, 'probe');

            for (let i = 0; i < toolData.data.length; i++) {
                if (toolData.data[i].id === measurementData.id) {
                    let elementSpecificMeasurementData = toolData.data[i];
                    const imagePoint = getImagePoint(patientPoint, ele);
                    elementSpecificMeasurementData.handles.end.x = imagePoint.x;
                    elementSpecificMeasurementData.handles.end.y = imagePoint.y;
                }
            }

            cornerstone.updateImage(ele);
        }
    });

    let fiducial = {
      'patientPoint': patientPoint
    }

    fiducialsCollection.update({ 'id': measurementData.id }, { $set: fiducial });
}


function bindToMeasurementAdded(element) {
    $(element).bind('cornerstonetoolsmeasurementadded', (eve) => {
        let ev = eve.originalEvent;
        if (ev.detail.toolType === 'probe') {
            addFiducial(ev.target, ev.detail.measurementData);
        }
    });
}


function bindToMeasurementRemoved(element) {
    $(element).bind('cornerstonemeasurementremoved', (eve) => {
        let ev = eve.originalEvent;
        if (ev.detail.toolType === 'probe') {
            removeFiducial(ev.target, ev.detail.measurementData);
        }
    });
}


function bindToMeasurementModified(element) {
    $(element).bind('cornerstonetoolsmeasurementmodified', (eve) => {
        let ev = eve.originalEvent;
        if (ev.detail.toolType === 'probe') {
            $(this).off('mouseup').one('mouseup', () => {
                modifyFiducial(ev.target, ev.detail.measurementData);
            });
        }
    });
}


$('.imageViewerViewport').waitUntilExists((index, element) => {
    bindToMeasurementAdded(element);
    bindToMeasurementRemoved(element);
    bindToMeasurementModified(element);
});


$('.toolbarSectionTools').waitUntilExists((index, element) => {
    $(element).children().bind('click', (ev) => {
        const activeTool = ev.currentTarget.id;
        if (activeTool === 'probe') {
            $('.imageViewerViewport').each((index, ele) => {
                cornerstoneTools.scrollToIndex(ele, 0);
                probeSynchronizer.add(ele);
            });
        }
        else if (probeSynchronizer) {
            probeSynchronizer.destroy();
        }
    });
});
