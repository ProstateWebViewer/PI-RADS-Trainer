import { Mongo } from 'meteor/mongo';
import { cornerstoneTools } from 'meteor/ohif:cornerstone'
import { $ } from 'meteor/jquery';
import { waitUntilExists } from 'jquery.waituntilexists'

fiducials = new Mongo.Collection('fiducials', {connection: null});
let counter = 0;

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
});
