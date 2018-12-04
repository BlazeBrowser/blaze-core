const electron = require('electron');
const path = require('path');
const fs = require('fs');
var fsPath = require('fs-path');
var XMLHttpRequest = require('xhr2');
var new_version_app=3;
var files_installing=0;
var files_installed=0;
var update_status="Downloading file lists";
var update_avalable=null;
var update_failed=false;
var update_url="https://raw.blazebrowser.com/";
const appDataPath = (electron.app || electron.remote.app).getPath('userData');

var getJSON = function(url, callback){
  var xhr = new XMLHttpRequest();
  xhr.open('GET', url, true);
  xhr.responseType = 'json';
  xhr.onload = function() {
    var status = xhr.status;
    if (status === 200) {
      callback(null, xhr.response);
    } else {
      callback(status, JSON.parse(xhr.response));
    }
  };
  xhr.send();
};

var getFILE = function(url, callback) {
  var xhr = new XMLHttpRequest();
  xhr.open('GET', url, true);
  xhr.onload = function() {
    var status = xhr.status;
    if (status === 200) {
      callback(null, xhr.response);
    } else {
      callback(status, xhr.response);
    }
  };
  xhr.send();
};

class updater{

  updater_check_installed(version_core,version_app,branch){
    //--Check if the browser is even installed in the user folder...
    var update_needed=true;

    if (version_app=="fresh_0.01"){
      update_needed=false;
    }

    new_version_app=version_app;

    return update_needed;
  }

  updater_check_updates(version_core,version_app,branch){
    new_version_app=version_app;
    //--Check the web to see if we have a new version waiting for us...
    getJSON("" + update_url + "" + branch + "_version.json", function(err, response){
      if (err==null){
        if (response["version"]!=undefined){
          var new_version=response["version"];

          //--Hey if the new version is diffrent we should install it!
          if (new_version!=version_app){

            getJSON("" + update_url + "" + branch + "/main_updater_list.json", function(err2, response2){
              if (err2==null){
                if (response2["requirement_core"]<=version_core){
                  update_avalable=true;
                }else{
                  update_avalable=false;
                }
              }else{
                update_avalable=false;
              }
            });

          }
        }
      }else{
        update_avalable=false;
      }
    });
  }

  updater_run_updates(version_core,version_app,branch){
    new_version_app=version_app;
    //--Check the web to see if we have a new version waiting for us...
    getJSON("" + update_url + "" + branch + "_version.json", function(err, response){
      if (err==null){
        if (response["version"]!=undefined){
          var new_version=response["version"];
          //--Hey if the new version is diffrent we should install it!
          if (new_version!=version_app){
            updater_install_updates(version_core,version_app,branch,new_version);
          }
        }else{
          update_failed=true;
        }
      }else{
        update_failed=true;
      }
    });
  }

  updater_get_version(){
    return new_version_app;
  }

  updater_get_failed(){
    return update_failed;
  }

  updater_get_status(){
    return update_status;
  }

  updater_get_avalable(){
    return update_avalable;
  }
}

function updater_install_updates(version_core,version_app,branch,new_version){
  //--If we have a new version waiting for us this is called so we can update all the files on the fly.
  getJSON("" + update_url + "" + branch + "/main_updater_list.json", function(err, response){
    if (err==null){
      if (response["requirement_core"]!=undefined){
        if (response["requirement_core"]==version_core){

          update_status="Downloading files";

          response["filelist"].forEach(function(s){
            files_installing=files_installing+1;
          });

          //Start download chain
          updater_download_file(response["filelist"],version_core,version_app,branch,new_version);

        }else{
          //--We cant update remote, you need to redownload!
          update_failed=true;
        }
      }else{
        console.log("CANT INSTALL! MISSION CORE REQUIREMENT VAR!");
        update_status="Core version not correct for update";
        update_failed=true;
      }
    }
  });
}

function updater_download_file(filelist,version_core,version_app,branch,new_version){
  //Fetch and download file
  var filedown=filelist[files_installed]["file"];

  var filename=filedown.replace(".js", "");
  var filename=filename.replace("/browser/", "");
  update_status="File " + filename + " downloading (" + files_installed + "/" + files_installing + ")";

  var fileurl="" + update_url + "" + branch + "" + filedown + '?version=' + new_version + '';
  getFILE(fileurl, function(err, response){
    if (err==null){
      var thispath=path.join(appDataPath,'src' + filedown + '');
      fsPath.writeFile(thispath, response, function(err){
        if(err){
          update_status="Cant write file " + filename + " to disk";
          update_failed=true;
          throw err;
        }else{
          update_status="File " + filename + " downloaded (" + files_installed + "/" + files_installing + ")";
        }

        //--Download of file done
        files_installed=files_installed+1;
        if (files_installed<files_installing){
          updater_download_file(filelist,version_core,version_app,branch,new_version);
        }else{
          updater_download_finished(new_version);
        }

      });
    }else{
      update_status="Downloading file " + filename + " failed";
      update_failed=true;
    }

  });
}

function updater_download_finished(new_version){
  //--Update done!
  update_status="Checking files";

  setTimeout(function(){
    new_version_app=new_version;
    update_status="Done";
  }, 200);
}

function writeFile(path, contents) {
  mkdirp(getDirName(path), function (err) {
    if (err) return cb(err);

    fs.writeFile(path, contents);
  });
}

module.exports = updater;
