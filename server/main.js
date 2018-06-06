import { Meteor } from 'meteor/meteor';
import csv from 'fast-csv';
import fs from 'fs';

Fiducials = new Mongo.Collection('fiducials');


if (Fiducials.find().count() === 0) {
  const stream = fs.createReadStream("assets/app/findings.csv");

  csv.fromStream(stream, {
    headers: true
  }).on("data", Meteor.bindEnvironment((data) => {
    const pos = data.pos.split(" ").map(Number);
    const fiducial = {
      ProxID: data.ProxID,
      fid: data.fid,
      pos: {
        x: pos[0],
        y: pos[1],
        z: pos[2]
      },
      zone: data.zone,
      ClinSig: data.ClingSig
    };
    Fiducials.insert(fiducial);
  })).on("end", function() {
    console.log("Done adding all the resualts!");
  });
}

Meteor.publish('fiducials.public', function() {
  return Fiducials.find();
});
