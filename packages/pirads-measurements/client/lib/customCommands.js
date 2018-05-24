import { Mongo } from 'meteor/mongo';
import { cornerstoneTools, cornerstone } from 'meteor/ohif:cornerstone'
import { $ } from 'meteor/jquery';
import { waitUntilExists } from 'jquery.waituntilexists'

fiducials = new Mongo.Collection('fiducials', {connection: null});
const probeSynchronizer = new cornerstoneTools.Synchronizer('cornerstonenewimage', cornerstoneTools.stackImagePositionSynchronizer);
let fiducialCounter = 0;

function imagePointToPatientPoint (imagePoint, imagePlane) {
    const x = imagePlane.rowCosines.clone().multiplyScalar(imagePoint.x);
    x.multiplyScalar(imagePlane.columnPixelSpacing);

    const y = imagePlane.columnCosines.clone().multiplyScalar(imagePoint.y);
    y.multiplyScalar(imagePlane.rowPixelSpacing);

    const patientPoint = x.add(y);
    patientPoint.add(imagePlane.imagePositionPatient);

    return patientPoint;
}

function projectPatientPointToImagePlane (patientPoint, imagePlane) {
    const point = patientPoint.clone().sub(imagePlane.imagePositionPatient);
    const x = imagePlane.rowCosines.dot(point) / imagePlane.columnPixelSpacing;
    const y = imagePlane.columnCosines.dot(point) / imagePlane.rowPixelSpacing;

    return {x, y};
}

function addFiducialData(element, data) {
    fiducialCounter++;
    fiducials.insert({'measurementNumber': fiducialCounter, 'data': data, '_id': fiducialCounter.toString(), 'x': Math.round(data.handles.end.x), 'y': Math.round(data.handles.end.y)});
    syncFiducial(element, data, 'add');
}

function removeFiducialData(element, data) {
    fiducialCounter = 0;
    fiducials.remove({});
    fiducialArray = cornerstoneTools.globalImageIdSpecificToolStateManager.get(element, 'probe')['data'];
    fiducialArray.forEach((val) => {
        addFiducialData(element, val);
    });
    syncFiducial(element, data, 'remove');
}

function addFiducail(targetElement, sourceElement, measurementData) {
    const image = cornerstone.getEnabledElement(sourceElement).image;
    const imagePlane = cornerstone.metaData.get('imagePlaneModule', image.imageId);
    const patientPoint = imagePointToPatientPoint(measurementData.handles.end, imagePlane);

    const TargetImage = cornerstone.getEnabledElement(targetElement).image;
    const TargetImagePlane = cornerstone.metaData.get('imagePlaneModule', TargetImage.imageId);
    imagePoint = projectPatientPointToImagePlane(patientPoint, TargetImagePlane);
    let newMeasurementData = $.extend(true, {}, measurementData);

    newMeasurementData.handles.end.x = imagePoint.x
    newMeasurementData.handles.end.y = imagePoint.y

    cornerstoneTools.addToolState(targetElement, 'probe', newMeasurementData);
    cornerstone.updateImage(targetElement);
}

function removeFiducail(targetElement, sourceElement, measurementData) {
    cornerstoneTools.clearToolState(targetElement, 'probe');
    cornerstone.updateImage(targetElement);
    fiducialArray = cornerstoneTools.globalImageIdSpecificToolStateManager.get(sourceElement, 'probe')['data'];
    fiducialArray.forEach((val) => {
        $(targetElement).off('cornerstonetoolsmeasurementadded');
        addFiducail(targetElement, sourceElement, val);
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
                removeFiducialData(ev.target, ev.detail.measurementData);
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
