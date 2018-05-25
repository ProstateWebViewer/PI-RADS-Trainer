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

function addFiducialData(element, measurementData) {
    const studyInstanceUid = OHIF.viewerbase.layoutManager.viewportData[Session.get('activeViewport')]['studyInstanceUid'];
    fiducialCounter++;
    const patientPoint = getPatientPoint(measurementData.handles.end, element);

    // TODO: use this, this is the index of the image
    // OHIF.viewer.data.loadedSeriesData[0].currentImageIdIndex

    fiducialsCollection.insert(
      {
        'viewportIndex': Session.get('activeViewport'),
        'studyInstanceUid': studyInstanceUid,
        'measurementNumber': fiducialCounter,
        'data': measurementData,
        '_id': fiducialCounter.toString(),
        'patientPoint': patientPoint,
        'x': Math.round(patientPoint.x),
        'y': Math.round(patientPoint.y)
      }
    );
    syncFiducial(element, measurementData, 'add');
}

function removeFiducialData(element, measurementData) {
    // fiducialCounter = 0;
    const studyInstanceUid = OHIF.viewerbase.layoutManager.viewportData[Session.get('activeViewport')]['studyInstanceUid'];
    const patientPoint = getPatientPoint(measurementData.handles.end, element);
    fiducialsCollection.remove({ 'x': Math.round(patientPoint.x), 'y': Math.round(patientPoint.y), 'studyInstanceUid': studyInstanceUid });
    // fiducialArray = cornerstoneTools.globalImageIdSpecificToolStateManager.get(element, 'probe')['data'];
    // fiducialArray = fiducialsCollection.find({ 'studyInstanceUid': studyInstanceUid }).fetch();
    // fiducialArray.forEach((val) => {
    //     addFiducialData(element, val['data']);
    // });
    syncFiducial(element, measurementData, 'remove');
}

function addFiducail(targetElement, sourceElement, measurementData) {
    const patientPoint = getPatientPoint(measurementData.handles.end, sourceElement);
    const imagePoint = getImagePoint(patientPoint, targetElement);

    let newMeasurementData = $.extend(true, {}, measurementData);

    newMeasurementData.handles.end.x = imagePoint.x
    newMeasurementData.handles.end.y = imagePoint.y

    cornerstoneTools.addToolState(targetElement, 'probe', newMeasurementData);
    cornerstone.updateImage(targetElement);
}

function removeFiducail(targetElement, sourceElement, measurementData) {
    const studyInstanceUid = OHIF.viewerbase.layoutManager.viewportData[Session.get('activeViewport')]['studyInstanceUid'];
    cornerstoneTools.clearToolState(targetElement, 'probe');
    cornerstone.updateImage(targetElement);
    // fiducialArray = cornerstoneTools.globalImageIdSpecificToolStateManager.get(sourceElement, 'probe')['data'];
    fiducialArray = fiducialsCollection.find({ 'studyInstanceUid': studyInstanceUid }).fetch();
    fiducialArray.forEach((val) => {
        $(targetElement).off('cornerstonetoolsmeasurementadded');
        addFiducail(targetElement, $('.imageViewerViewport')[val['viewportIndex']], val['data']);
        bindToMeasurementAdded(targetElement);
    });
}

function syncFiducial(element, measurementData, command) {
    $('.imageViewerViewport').each((index, ele) => {
        if (element !== ele) {
            if (command === 'add') {
                $(ele).off('cornerstonetoolsmeasurementadded');
                addFiducail(ele, element, measurementData);
                bindToMeasurementAdded(ele);
            }
            else if (command === 'remove') {
                $(ele).off('cornerstonemeasurementremoved');
                removeFiducail(ele, element, measurementData);
                bindToMeasurementRemoved(ele);
            }
        }
    });
}

function bindToMeasurementAdded(element) {
    $(element).bind('cornerstonetoolsmeasurementadded', (eve) => {
        let ev = eve.originalEvent;
        if (ev.detail.toolType === 'probe') {
            addFiducialData(ev.target, ev.detail.measurementData);
        }
    });
}

function bindToMeasurementRemoved(element) {
    $(element).bind('cornerstonemeasurementremoved', (eve) => {
        let ev = eve.originalEvent;
        if (ev.detail.toolType === 'probe') {
            removeFiducialData(ev.target, ev.detail.measurementData);
        }
    });
}

$('.imageViewerViewport').waitUntilExists((index, element) => {
    bindToMeasurementAdded(element);
    bindToMeasurementRemoved(element);
    $(element).bind('cornerstonetoolsmeasurementmodified', (eve) => {
        let ev = eve.originalEvent;
        if (ev.detail.toolType === 'probe') {
            $(this).off('mouseup').one('mouseup', () => {
                // const studyInstanceUid = OHIF.viewerbase.layoutManager.viewportData[Session.get('activeViewport')]['studyInstanceUid'];
                // fiducialArray = cornerstoneTools.globalImageIdSpecificToolStateManager.get(ev.target, 'probe')['data'].map(val => val['handles']);
                // fiducialArray.forEach((val) => {
                //     fiducialList = fiducialsCollection.find({ 'data': { 'handles': { 'end': { 'x': val['end']['x'], 'y': val['end']['y'] } } }, 'studyInstanceUid': studyInstanceUid }).fetch();
                //     console.log(fiducialList);
                //     // console.log(val['end']);
                // });
            });
        }
    });
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
