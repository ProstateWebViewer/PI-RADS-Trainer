import { Mongo } from 'meteor/mongo';
import { cornerstoneTools, cornerstone } from 'meteor/ohif:cornerstone'
import { $ } from 'meteor/jquery';
import { waitUntilExists } from 'jquery.waituntilexists'

fiducials = new Mongo.Collection('fiducials', {connection: null});
let fiducialCounter = 0;

function addFiducialData(element, data) {
    fiducialCounter++;
    fiducials.insert({'measurementNumber': fiducialCounter, 'data': data, '_id': fiducialCounter.toString(), 'x': Math.round(data.handles.end.x), 'y': Math.round(data.handles.end.y)});
    syncFiducial(element, data, 'add');
}

function removeFiducialData(element, data) {
    fiducialCounter = 0;
    fiducials.remove({});
    fiducialArray = cornerstoneTools.globalImageIdSpecificToolStateManager.get(element, 'probe')['data'].forEach((val) => {
        addFiducialData(element, val);
    });
    syncFiducial(element, data, 'remove');
}

function addFiducail(element, measurementData) {
    cornerstoneTools.addToolState(element, 'probe', measurementData);
    cornerstone.updateImage(element);
}

function removeFiducail(element, measurementData) {
    cornerstoneTools.removeToolState(element, 'probe', measurementData);
    cornerstone.updateImage(element);
}

function syncFiducial(element, measurementData, command) {
    $('.imageViewerViewport').each((index, ele) => {
        if (element !== ele) {
            if (command === 'add') {
                $(ele).off('cornerstonetoolsmeasurementadded');
                addFiducail(ele, measurementData);
                bindToMeasurementAdded(ele);
            }
            else if (command === 'remove') {
                $(ele).off('cornerstonemeasurementremoved');
                removeFiducail(ele, measurementData);
                bindToMeasurementRemoved(ele);
            }
        }
    });
}

function bindToMeasurementAdded(element) {
    $(element).bind('cornerstonetoolsmeasurementadded', (eve) => {
        let ev = eve.originalEvent;
        // console.log(cornerstone.getImage(ev.target));
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
