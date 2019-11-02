#!/usr/bin/env node

/*
  By Chris Eugene Mills
*/

'use strict';

const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const makeDir = require('make-dir');

const JSZip = require("jszip");
const THREE = require('three');
const flatten = require('flat');
const fastcsv = require('fast-csv');

// LOAD/PREPARE ////////////////////////////////////////////////////////////////

//Get File Path
const argv = require('minimist')(process.argv.slice(2));
if (!argv.hasOwnProperty('file') ) throw "Script must be run with a '--file' argument!";
const filename = argv.file;
const relname = path.relative(process.cwd(), filename);
const extension = path.extname(filename);
console.log(`File: ${relname}`);
if (![".ig", ".json", ""].includes(extension)) {
  throw "I don't recognize this format."
}

// Process
if (extension === ".ig") {
  console.log("Welcome to hell...");
  processZIP(filename, argv.hasOwnProperty('combine'));
} else {
  console.log("The event horizon approaches...");
  processSingleEvent(filename);
}

return /////////////////////////////////////////////////////////////////////////

async function processSingleEvent( _filename ) {
  //Load File // '../sample/Zee_0/Events/Run_140401/Event_91126796'
  const data = fs.readFileSync(_filename, "utf8");
  const curveData = await processJSON(data);
  await writeCSV(_filename, curveData);
}

async function processZIP( _filename, _combine = false ) {
  //Read ZIP
  const zipBuffer = await fsPromises.readFile( _filename );
  const zip = await JSZip.loadAsync(zipBuffer);
  const keys = Object.keys(zip.files).filter( key => key != 'Header')
  if (!keys.length) throw ".ig file is empty!"
  // console.log(keys);

  //Process subfiles
  let allCurves = [];
  for (let key of keys) {
    const data = await zip.file(key).async("string");
    const eventName = path.basename(_filename, ".ig") + '-' +
                      key.split(path.posix.sep).filter(word => word != "Events").join('-');
    console.log(eventName);
    let curveData = await processJSON(data);
    if (_combine) {
      allCurves = allCurves.concat(curveData);
      console.log("");
    } else {
      //Write each if need be
      await writeCSV(eventName, curveData);
    }
  }

  //Write all
  if (_combine) {
    await writeCSV(_filename, allCurves);
  }

  //
}


async function processJSON( _JSONstring ) {

  //Cleanup File
  const cleanupData = function(d) {
      // rm non-standard json bits
      // newer files will not have this problem
      d = d.replace(/\(/g,'[')
      .replace(/\)/g,']')
      .replace(/\'/g, "\"")
      .replace(/nan/g, "0");
      return d;
  };
  const eventData = JSON.parse(cleanupData(_JSONstring));

  //Itemize
  const types = eventData['Types'];
  const collections = eventData['Collections'];
  const associations = eventData['Associations'];

  //Find our main data
  const trackCollectionNames = ['Tracks_V1', 'Tracks_V2', 'Tracks_V3'];
  let tracks = null;
  for (let collection in collections) {
    if (trackCollectionNames.includes(collection)) {
      tracks = collections[collection];
      break;
    }
  }
  if (!tracks) throw "Track data in Collections doesn't exist!";
  console.log(`${tracks.length} tracks found.`);
  // console.log(tracks[0]);

  //Find extras
  let extras = collections['Extras_V1'];
  if (!extras) throw "Extras data in Collections doesn't exist!";
  console.log(`${extras.length} extras found.`);
  // console.log(extras[0]);

  //Find extras Associations
  let assocs = associations['TrackExtras_V1'];
  if (!assocs) throw "Extras data in Associations doesn't exist!";
  console.log(`${assocs.length} associations found.`);
  // console.log(assocs[0]);


  // CALCULATE & COLLECT ///////////////////////////////////////////////////////

  var curves = [];

  //For every association
  for ( var i = 0; i < assocs.length; i++ ) {

    let ti = assocs[i][0][1]; //track index
    let ei = assocs[i][1][1]; //extra index

    let pt = tracks[ti][2];
    let phi = tracks[ti][3];
  	let eta = tracks[ti][4];
    let charge = tracks[ti][5]
    let chi2 = tracks[ti][6]
    let ndof = tracks[ti][7]

    let pos1 = new THREE.Vector3(extras[ei][0][0],extras[ei][0][1],extras[ei][0][2]);
  	let dir1 = new THREE.Vector3(extras[ei][1][0],extras[ei][1][1],extras[ei][1][2]);

  	let pos2 = new THREE.Vector3(extras[ei][2][0],extras[ei][2][1],extras[ei][2][2]);
  	let dir2 = new THREE.Vector3(extras[ei][3][0],extras[ei][3][1],extras[ei][3][2]);

  	// Note from ispy-webgl (js/objects-draw.js)
    // What's all this then?
  	// Well, we know the beginning and end points of the track as well
  	// as the directions at each of those points. This in-principle gives
  	// us the 4 control points needed for a cubic bezier spline.
  	// The control points from the directions are determined by moving along 0.25
  	// of the distance between the beginning and end points of the track.
  	// This 0.25 is nothing more than a fudge factor that reproduces closely-enough
  	// the NURBS-based drawing of tracks done in iSpy. At some point it may be nice
  	// to implement the NURBS-based drawing but I value my sanity.

  	let distance = pos1.distanceTo(pos2);
  	let scale = 0.25;

    dir1.setLength(distance * scale);
    dir2.setLength(distance * scale);

    let han1 = new THREE.Vector3().addVectors(pos1, dir1);
    let han2 = new THREE.Vector3().subVectors(pos2, dir2);

    let bezierData = flatten({
      pos1,
      han1,
      han2,
      pos2,
      pt,
      phi,
      eta,
      charge,
      chi2,
      ndof
    }, {
      delimiter: '_'
    });

    curves.push(bezierData);
  }
  // Now we have all the data we can mine from the tracks...
  return curves;
}


async function writeCSV( _filename, _data ) {
  // WRITE OUTPUT //////////////////////////////////////////////////////////////
  // Expects an array of objects for each line

  const folderpath = path.join(process.cwd(), "ig-to-csv-output");
  const csvpath = path.join(folderpath, path.basename(_filename) + ".csv");

  //Ensure export directory exists
  await makeDir(folderpath);

  //Write!
  const ws = fs.createWriteStream(csvpath);
  fastcsv
    .write(_data, { headers: true })
    .pipe(ws);

  console.log("Finished!\nWritten to " + path.relative(process.cwd(), csvpath) + '\n');
}
