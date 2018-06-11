import { Mongo } from 'meteor/mongo';
import { cornerstoneTools, cornerstone } from 'meteor/ohif:cornerstone'
import { $ } from 'meteor/jquery';
import { waitUntilExists } from 'jquery.waituntilexists'


fiducialsCollection = new Mongo.Collection('fiducialsCollection', {connection: null});
const probeSynchronizer = new cornerstoneTools.Synchronizer('cornerstonenewimage', cornerstoneTools.stackImagePositionSynchronizer);
let fiducialCounter = {};


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

function drawId(e) {
  const eventData = e.detail;

  // If we have no toolData for this element, return immediately as there is nothing to do
  const toolData = cornerstoneTools.getToolState(e.currentTarget, 'probe');

  if (!toolData) {
    return;
  }

  // We have tool data for this element - iterate over each one and draw it
  const context = eventData.canvasContext.canvas.getContext('2d');

  context.setTransform(1, 0, 0, 1, 0, 0);

  const font = cornerstoneTools.textStyle.getFont();
  const fontHeight = cornerstoneTools.textStyle.getFontSize();

  for (let i = 0; i < toolData.data.length; i++) {
    context.save();
    const data = toolData.data[i];

    if (data.visible === false) {
      continue;
    }

    const color = cornerstoneTools.toolColors.getColorIfActive(data);

    const x = Math.round(data.handles.end.x);
    const y = Math.round(data.handles.end.y);
    let storedPixels;
    let text;

    if (!data.hasOwnProperty('server')) {
      text = 'fid ' + data.id;
    }
    else {
      const id = data.id.split('.')[1];
      text = (data.ClinSig) ? 'Clinical Significant (CS-' + id + ')' : 'Clinical Not Significant (CNS-' + id + ')';
    }

    if (x < 0 || y < 0 || x >= eventData.image.columns || y >= eventData.image.rows) {
      return;
    }

    const coords = {
      // Translate the x/y away from the cursor
      x: data.handles.end.x + 3,
      y: data.handles.end.y - 3
    };
    const textCoords = cornerstone.pixelToCanvas(eventData.element, coords);

    context.font = font;
    context.fillStyle = color;

    cornerstoneTools.drawTextBox(context, text, textCoords.x, textCoords.y - fontHeight - 5, color);
    context.restore();
  }
}

// TODO: clean and comment for all the functions
function addFiducial(element, measurementData) {

    const studyInstanceUid = OHIF.viewerbase.layoutManager.viewportData[Session.get('activeViewport')]['studyInstanceUid'];
    const studyInstanceUidString = studyInstanceUid.toString();

    if (fiducialCounter.hasOwnProperty(studyInstanceUidString)) {
        fiducialCounter[studyInstanceUidString]++;
    }
    else {
        fiducialCounter[studyInstanceUidString] = 1;
    }

    cornerstoneTools.removeToolState(element, 'probe', measurementData);
    cornerstone.updateImage(element);

    const patientPoint = getPatientPoint(measurementData.handles.end, element);
    let imageIds = [];

    $('.imageViewerViewport').each((index, ele) => {

        let elementSpecificMeasurementData = $.extend(true, {}, measurementData);
        const imagePoint = getImagePoint(patientPoint, ele);
        const id = fiducialCounter[studyInstanceUidString]

        if (measurementData.hasOwnProperty('server')) {
            id = 'server.'.concat(measurementData.f_id);
        }

        elementSpecificMeasurementData.handles.end.x = imagePoint.x;
        elementSpecificMeasurementData.handles.end.y = imagePoint.y;
        elementSpecificMeasurementData.id = id;
        elementSpecificMeasurementData.active = false;

        if (isInBoundary(ele, elementSpecificMeasurementData.handles.end)) {
            $(ele).off('cornerstonetoolsmeasurementadded');
            cornerstoneTools.addToolState(ele, 'probe', elementSpecificMeasurementData);
            cornerstone.updateImage(ele);
            bindToMeasurementAdded(ele);

            imageIds.push(cornerstone.getEnabledElement(ele).image.imageId);
        }
    });

    if (!measurementData.hasOwnProperty('server')) {
        let fiducial = {
          'id': fiducialCounter[studyInstanceUidString],
          'studyInstanceUid': studyInstanceUid,
          'imageIds': imageIds,
          'patientPoint': patientPoint
        }

        // console.log(patientPoint);

        fiducialsCollection.insert(fiducial);
    }
    else {
        fiducialCounter[studyInstanceUidString]--;
    }
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
    $(element).on('cornerstonetoolsmeasurementadded', (eve) => {
        let ev = eve.originalEvent;
        if (ev.detail.toolType === 'probe') {
            addFiducial(ev.target, ev.detail.measurementData);
        }
    });
}


function bindToMeasurementRemoved(element) {
    $(element).on('cornerstonemeasurementremoved', (eve) => {
        let ev = eve.originalEvent;
        if (ev.detail.toolType === 'probe') {
            removeFiducial(ev.target, ev.detail.measurementData);
        }
    });
}


function bindToMeasurementModified(element) {
    $(element).on('cornerstonetoolsmeasurementmodified', (eve) => {
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
    $(element).children().on('click', (ev) => {
        const activeTool = ev.currentTarget.id;
        if (activeTool === 'probe') {
            $('.imageViewerViewport').each(async (index, ele) => {
                // TODO: not a good idea to wait till we scroll, see if there is a better way!
                $(ele).on('cornerstoneimagerendered', (e) => {
                    drawId(e.originalEvent);
                });
                await function scroll() {
                    return new Promise((resolve) => {
                        setTimeout(() => {
                            cornerstoneTools.scrollToIndex(ele, 0);
                            resolve('resolved');
                        }, 1);
                    });
                }();

                probeSynchronizer.add(ele);
            });
        }
        else if (probeSynchronizer) {
            probeSynchronizer.destroy();
        }
    });
});
