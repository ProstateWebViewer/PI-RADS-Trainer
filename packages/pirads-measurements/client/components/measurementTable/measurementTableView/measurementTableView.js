import { Template } from 'meteor/templating';
import { Tracker } from 'meteor/tracker';
import { ReactiveVar } from 'meteor/reactive-var';
import { _ } from 'meteor/underscore';
import { OHIF } from 'meteor/ohif:core';


Template.measurementTableView.helpers({
    fiducials() {
        const studyInstanceUid = window.location.pathname.split('/')[2];
        return fiducialsCollection.find({'studyInstanceUid': studyInstanceUid}).fetch();
    },
});
