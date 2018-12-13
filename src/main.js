const electron = require('electron');
const app = electron.app;
const BrowserWindow = require('electron').BrowserWindow;
const session = require('electron').session;
const path = require('path');
const url = require('url');
const fs = require('fs');
const storage = require('./main_storage.js');
const updater_system = require('./main_updater.js');
const updater = new updater_system();
const appDataPath = (electron.app || electron.remote.app).getPath('userData');
var ipcMain = require('electron').ipcMain;
var win=null;
var update_win=null;
var version_core=6;
var launchcommand="nothing";
var launchurl="nothing";
var system_open=false;
app.setName("Blaze");

//--Build in functions to regix
RegExp.escape = function(string) {
  return string.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
};

//--Load up the storage files from disk and start up the functions to call and save data
const storage_preferences = new storage({
  config_name: 'preferences',
  defaults: {
    data: { "window_width": 1024, "window_height": 768 }
  }
});
const storage_settings = new storage({
  config_name: 'settings',
  defaults: {
    data: { "browser_id": null }
  }
});

global.storage_settings=storage_settings.get('data');
global.storage_preferences=storage_preferences.get('data');
global.version_core=version_core;

//--browser.js is sending us the data back so we can save it
ipcMain.on('update_storage_settings', function(event, arg) {
  global.storage_settings=arg;
});
ipcMain.on('update_storage_preferences', function(event, arg) {
  global.storage_preferences=arg;
});

//--Update old settings
if (global.storage_settings["version_branch"]=="alpha"){
  global.storage_settings["version_branch"]="master";
}
if (global.storage_settings["version_branch"]=="current"){
  global.storage_settings["version_branch"]="stable";
}

//--App is closed, time to save data
app.on('window-all-closed', function(){
  //Save data first to disk!!!!
  storage_settings.set('data', global.storage_settings);
  storage_preferences.set('data', global.storage_preferences);
  //OK now quit the app
  app.quit();
});

//--When we get a protocol link send it to the browser!
app.on('open-url', function (event, data) {
  event.preventDefault();
  if (system_open==true){
    open_url(data);
  }else{
    launchurl=data;
  }
});

//--Browser is now loading, time to run checks!
app.on("ready", function(){

  //--Check for updates first!
  if (global.storage_settings["version"]==undefined){
    global.storage_settings["version"]="fresh_0.01";
  }
  if (global.storage_settings["version_branch"]==undefined){
    global.storage_settings["version_branch"]="stable";
  }
  var needupdate=false;

  var installed=updater.updater_check_installed(version_core,global.storage_settings["version"],global.storage_settings["version_branch"]);
  if (installed==false){ needupdate=true; }

  //--If needs to update run the update, else lets launch the browser
  if (needupdate==false){
    //Launch the browser!
    start_browser();
    start_checkupdates();
  }else{
    start_updates();
  }

  //Startup basic commands
  storage_update_disk();

});

//--Save the storage data to disk every so often
function storage_update_disk(){
  storage_settings.set('data', global.storage_settings);
  storage_preferences.set('data', global.storage_preferences);
  setTimeout(function(){ storage_update_disk(); }, 60000);
}

//--Check with server if an update is ready
function start_checkupdates(){
  console.log("MAIN: Checking for updates");
  updater.updater_check_updates(version_core,global.storage_settings["version"],global.storage_settings["version_branch"]);
  setTimeout(function(){ start_checkupdates_refresh(); }, 30);
}

//--Check if updates are avalable after the browser first opens
function start_checkupdates_refresh(){
  var update_avalable=updater.updater_get_avalable(version_core,global.storage_settings["version"],global.storage_settings["version_branch"]);

  if (update_avalable==true){
    start_updates();
    win.close();
  }else{
    if (update_avalable==null){
      setTimeout(function(){ start_checkupdates_refresh(); }, 30);
    }
  }
}

//--Start running updates via the updater
function start_updates(){
  update_win = new BrowserWindow({width: 600, height: 400 });
  update_win.loadURL(url.format({
    pathname: path.join(__dirname, 'update.html'),
    protocol: 'file:',
    slashes: true
  }));

  console.log("MAIN: Installing updates");
  updater.updater_run_updates(version_core,global.storage_settings["version"],global.storage_settings["version_branch"]);
  setTimeout(function(){ start_updates_status(); }, 5);
}

//--Check if the updates are done getting installed and start the browser if done
function start_updates_status(){
  var updatedone=false;

  //--Check if the update is good
  var installed=updater.updater_get_version();
  if (installed!=global.storage_settings["version"]){
    global.storage_settings["version"]=installed;
    launchcommand="update_installed";
    updatedone=true;
  }

  //--Check if the update failed
  var failedupdate=updater.updater_get_failed();
  if (failedupdate==true){
    updatedone=true;
    launchcommand="update_failed";
  }

  //--Send progress to the update window
  var update_status=updater.updater_get_status();
  update_win.webContents.send('progress' , {status:update_status});

  //--If the update is done we can close the update window and open the browser
  if (updatedone==true){
    setTimeout(function(){ start_browser(); }, 100);
    setTimeout(function(){ update_win.close(); }, 200);
  }else{
    setTimeout(function(){ start_updates_status(); }, 5);
  }
}

//--Start main browser process
function start_browser(){
  console.log("MAIN: Starting browser...");
  win = new BrowserWindow({width: global.storage_preferences["window_width"], height: global.storage_preferences["window_height"], transparent: true, frame: false, webPreferences: { partition: "persist:browserwindow", experimentalFeatures: true } });

  //--Check if a internal dev version, if so we use the internal browser copy not the downloaded one
  if (global.storage_settings["internaldev"]==undefined){
    var loadpath=appDataPath;
    var browserpath="src/";
  }else{
    console.log("MAIN: Internal DEV mode used");
    console.log("MAIN: Loading from " + __dirname + "");
    var loadpath=__dirname;
    var browserpath="";
  }

  win.loadURL(url.format({
    pathname: path.join(loadpath, '' + browserpath + 'browser/browser.html'),
    protocol: 'file:',
    slashes: true
  }));

  console.log("MAIN: Loaded browser from " + loadpath + "/" + browserpath + "browser/browser.html");

  system_open=true;

  if (launchcommand!="nothing"){
    setTimeout(function(){ win.webContents.send('startup_command' , {command:launchcommand}); }, 3000);
  }

  if (launchurl!="nothing"){
    setTimeout(function(){ win.webContents.send('startup_url' , {url:launchurl}); }, 1000);
  }

  //--load default menu
  require("./main_menu.js");

  //--Load session from the browser tabs, window uses persist:browserwindow and the tabs in the browser use persist:webviewsession
  var ses = session.fromPartition('persist:webviewsession');
  var ses_main = session.fromPartition('persist:browserwindow');

  ses.webRequest.onBeforeRequest(['*://*./*'], function(details, callback) {
    var test_url=details.url;
    var block_me = false;

    //Check the web filter Blocklist
    var blacklistdata=global.storage_preferences["security_webrequest_blocklist"];
    if (blacklistdata!==undefined){
      if (blacklistdata !== undefined || blacklistdata.length != 0) {
        for (var webfilter in blacklistdata){
          if (blacklistdata.hasOwnProperty(webfilter)){
             if (blacklistdata[webfilter]==true){
               if (webrequest_blocklist_check(webfilter,test_url)==true){ block_me=true; }
             }
          }
        }
      }else{
        console.log("MAIN: Filters failed");
      }
    }else{
      console.log("MAIN: Filters failed");
    }

    if (block_me==true){
      callback({cancel: true});
    }else{
      callback({cancel: false});
    }
  });

  //--Send the browser ID with any requests to the official domain
  var filter_headers_browserid = {
    urls: ["https://*.blazebrowser.com/*"]
  };

  ses.webRequest.onBeforeSendHeaders(filter_headers_browserid, function(details, callback){
    details.requestHeaders['Browser-ID'] = global.storage_settings["browser_id"];
    callback({cancel: false, requestHeaders: details.requestHeaders});
  });
  ses_main.webRequest.onBeforeSendHeaders(filter_headers_browserid, function(details, callback){
    details.requestHeaders['Browser-ID'] = global.storage_settings["browser_id"];
    callback({cancel: false, requestHeaders: details.requestHeaders});
  });

  console.log("MAIN: Browser startup finished");
}

//--Fires when the app is sent a url to load! Pass it on to the browser if it's open!
function open_url(data){
  if (system_open==true){
    win.webContents.send('startup_url' , {"url":data});
  }
}

//--Web filter blocklist checks!
var data_webrequest_blocklist_saved={};
function webrequest_blocklist_check(list,content){
  //--Check if we have list loaded already
  var datacheck="error";
  var block_me=false;
  if (data_webrequest_blocklist_saved["saved_" + list + ""]!=undefined){
    //--Is already set so lets load it
    var datacheck=data_webrequest_blocklist_saved["" + list + ""];
  }else{
    //--Not set so lets load the file and make the data
    fs.readFile(path.join(appDataPath, 'src/browser/data/webrequest_blocklist_' + list + '.txt'), 'utf8', (err, data) => {
      if (data!=""){
        if (err){
          datacheck="error.notfound.blazebrowser.com\n";
          datacheck=datacheck.toString().split("\n");
        }else{
          datacheck=data;
          datacheck=datacheck.toString().split("\n");
        }
      }else{
        datacheck="error.notfound.blazebrowser.com\n";
        datacheck=datacheck.toString().split("\n");
      }

      data_webrequest_blocklist_saved["saved_" + list + ""]=true;
      data_webrequest_blocklist_saved["" + list + ""]=datacheck;
    });
  }

  //--Check if we have an ad script
  if (datacheck!="error"){
    datacheck.forEach(function(entry){
      if (entry!=""){
        var regix=new RegExp(RegExp.escape(entry), "i");
        var block=regix.test(content);
        if (block==true){
          block_me=true;
        }
      }
    });
  }

  return block_me;
}
