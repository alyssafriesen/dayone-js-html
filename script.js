$(function() {
  var fileSelector = '#fileSelector';
  var dragAndDropSelector = '#dragAndDrop';
  var renderTargetSelector = '#dayOneRenderTarget';
  var entryTemplateSelector = '#dayOneEntryTemplate';

  var DayOneEntry = function(plistData) {
    this.data = plistData;
    this.photoDataURL = '';
  };

  DayOneEntry.prototype.get = function(key) {
    return this.data[key];
  };

  DayOneEntry.prototype.UUID = function() {
    return this.get('UUID');
  };

  DayOneEntry.prototype.creationDateNumeric = function() {
    return new Date(this.get('Creation Date')).getTime();
  };

  DayOneEntry.prototype.creationDateTime = function() {
    return moment(this.get('Creation Date')).format('MMMM Do YYYY, h:mm a');
  };

  DayOneEntry.prototype.creationDate = function() {
    return moment(this.get('Creation Date')).format('MMMM Do YYYY');
  };

  DayOneEntry.prototype.creationTime = function() {
    return moment(this.get('Creation Date')).format('h:mm a');
  };

  DayOneEntry.prototype.text = function() {
    return marked(this.get('Entry Text'));
  };

  DayOneEntry.prototype.hasPhoto = function() {
    return this.photoDataURL != '';
  };

  DayOneEntry.prototype.setPhotoDataURL = function(dataURL) {
    this.photoDataURL = dataURL;
  };

  DayOneEntry.prototype.getPhotoDataURL = function() {
    return this.photoDataURL;
  };

  var DayOneRenderer = function() {
    var _this = this;
    this.entries = {};

    $(dragAndDropSelector).on('drop', function(e) {
      e.stopPropagation();
      e.preventDefault();
      _this.handleFileSelect(e.originalEvent.dataTransfer.items);
    }).on('dragover dragenter', function(e) {
      e.preventDefault();
      e.stopPropagation();
    });
  };

  DayOneRenderer.prototype.onEntryTextLoaded = function(text) {
    var plistData = PlistParser.parse(text);
    this.addEntry(new DayOneEntry(plistData));
  };

  DayOneRenderer.prototype.addEntry = function(dayOneEntry) {
    this.entries[dayOneEntry.UUID()] = dayOneEntry;
  };

  DayOneRenderer.prototype.getEntries = function() {
    return _.sortBy(_.values(this.entries), function(e) {
      return e.creationDateNumeric();
    });
  };

  DayOneRenderer.prototype.handleFileSelect = function(files)  {
    var _this = this;

    if(files.length === 0) {
      return;
    };
    var root = files[0].webkitGetAsEntry();

    this.loadEntries(root, function() {
      _this.render();
    });
  };

  DayOneRenderer.prototype.loadEntries = function(root, onComplete) {
    var _this = this;
    root.getDirectory('entries', null, function(entriesDirectory) {
      var directoryReader = entriesDirectory.createReader();
      var allEntries = [];
      var processEntries = function() {
        var entryCount = allEntries.length;
        var entriesProcessed = 0;
        allEntries.forEach(function(entry) {
          entry.file(function(file) {
            var fileReader = new FileReader();
            fileReader.onload = function() {
              _this.onEntryTextLoaded(fileReader.result);
              entriesProcessed++;
              if(entriesProcessed == entryCount) {
                _this.loadPhotos(root, onComplete);
              }
            };
            fileReader.readAsText(file, 'UTF-8');
          });
        });
      };
      var readEntries = function() {
        directoryReader.readEntries(function(entries) {
          if(entries.length == 0) {
            processEntries(allEntries);
          }
          else
          {
            allEntries = allEntries.concat(entries);
            readEntries();
          }
        });
      };
      readEntries();
    });
  };

  DayOneRenderer.prototype.loadPhotos = function(root, onComplete) {
    var _this = this;
    root.getDirectory('photos', null, function(photosDirectory) {
      var directoryReader = photosDirectory.createReader();
      var allPhotos = [];
      var processPhotos = function(photos) {
        var photosProcessed = 0;
        photos.forEach(function(photo) {
          photo.file(function(file) {
            var fileName = file.name.substring(0, 32);
            var fileReader = new FileReader();
            fileReader.onload = function(e) {
                var dataURL = fileReader.result;
                var entry = _this.entries[fileName];
                if(entry) {
                  entry.setPhotoDataURL(dataURL);
                } else {
                  console.log("No entry found for photo: " + fileName);
                }
                photosProcessed++;
                if(photosProcessed === photos.length) {
                  onComplete();
                }
            }
            fileReader.readAsDataURL(file);
          });
        });
      };
      var readPhotos = function() {
        directoryReader.readEntries(function(photos) {
          if(photos.length === 0) {
            processPhotos(allPhotos);
          }
          else {
            allPhotos = allPhotos.concat(photos);
            readPhotos();
          }
        });
      };
      readPhotos();
    });
  };

  DayOneRenderer.prototype.render = function() {
    var $target = $(renderTargetSelector);
    $(fileSelector).hide();
    $target.show();

    var template = _.template($(entryTemplateSelector).html());

    this.getEntries().forEach(function(entry) {
      setTimeout(function() {
        var html = template({entry: entry});
        $target.append(html);
      }, 0);
    });
  };

  window.dayOneRenderer = new DayOneRenderer();
});