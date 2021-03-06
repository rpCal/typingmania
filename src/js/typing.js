/**
 * TypingMania Main File
 * ----------------------------------------------
 * Copyright 2013 (c) Nat Pavasant
 * Available under the term of MIT License
 * See LICENSE file for more detail
 */

define(function(require) {

// Default background image used during game preloading.
var BACKGROUND = 'data/background.jpg';

// Song list and main configuration file.
var SETTINGS   = 'data/settings.json';

// Engine Version
var VERSION = '0.4.0';
var SAVE_VERSION = 'sv00004';

var $ = window.jQuery;
var WebFont = window.WebFont;

var BasicSound = require('lib/sound').BasicSound;
var Loader = require('lib/loader');

console.log(BasicSound);
console.log("Hello!");

/// ///////////////////////
///  Basic prerequisite checking
if ($ == undefined || WebFont == undefined || $.jStorage == undefined) {
    document.write("<p style=\"font-size:300%;color:#c00;text-align:center\">Error: Prerequisite not satisfied. Please check.</p>");
    throw 'Prerequisite not satisfied.';
}

/// ///////////////////////
/// Helper

/**
 * This is utilities for class extending. It's copied from
 * TypeScript-generated file.
 *
 * @param d   descendant class
 * @param b   base class
 */
var $extends = function (d, b) {
    for (var p in b)
        if (b.hasOwnProperty(p))
            d[p] = b[p];

    function __() {
        this.constructor = d;
    }

    __.prototype = b.prototype;
    d.prototype = new __();
};

var $comma = function (nStr) {
    nStr += '';
    var x = nStr.split('.');
    var x1 = x[0];
    var x2 = x.length > 1 ? '.' + x[1] : '';
    var rgx = /(\d+)(\d{3})/;
    while (rgx.test(x1)) {
        x1 = x1.replace(rgx, '$1' + ',' + '$2');
    }
    return x1 + x2;
};

var $formatNumber = function (num, l) {
    var ret = "" + num;
    while (ret.length < l)
        ret = "0" + ret;
    return ret;
};

/// ///////////////////////
/// Song Engine
/**
 * Handle each character specifically Japanese Kana
 * that can be input multiple ways.
 */
var TypingChar = (function() {
    function TypingChar(character) {
        this.input = "";
        this.character = character;
        this.possibleInput = Kana.getPossibleRomaji(character.toLowerCase());

        // Sanitation
        for (var i = 0; i < this.possibleInput.length; i++) {
            this.possibleInput[i] = this.possibleInput[i].replace(/[^A-Za-z0-9 \.',/\\\-\?]/g, ' ');
        }

        this.complete = false;
        this.remainingText = this.possibleInput[0];
    }

    TypingChar.prototype.accept = function (character) {
        var accept = false;
        var _this = this;

        // Loop through each possible input to see if current input fits.
        var tmpText = this.input + character;
        this.possibleInput.forEach(function (c) {
            if (c.length == tmpText.length && c == tmpText) {
                accept = true;
                _this.complete = true;
            } else if (c.length > tmpText.length && c.substring(0, tmpText.length) == tmpText) {
                accept = true;
            }
        });

        if (accept) {
            this.input += character;
            this.recalculateRemainingText();
        }

        var ret = 0;

        if (accept && this.complete) {
            var toEnd = this.possibleInput[0].length - this.input.length + 1;
            if (toEnd >= 0)
                ret = toEnd;
            else
                ret = 0;
        } else if (accept) {
            if (this.input.length <= this.possibleInput[0].length)
                ret = 1;
        } else if (!accept) {
            ret = -1;
        }

        return ret;
    };

    TypingChar.prototype.getRemainingText = function () {
        return this.remainingText;
    };

    TypingChar.prototype.isComplete = function () {
        return this.complete;
    };

    TypingChar.prototype.recalculateRemainingText = function() {
        if (this.complete) {
            this.remainingText = "";
            return;
        }

        var tmp = this.possibleInput[0];
        var _this = this;
        this.possibleInput.forEach(function (c) {
            if (_this.input.length <= c.length && _this.input == c.substring(0, _this.input.length)) {
                var t = c.substring(_this.input.length, c.length);
                if (t.length < tmp.length) {
                    tmp = t;
                }
            }
        });

        this.remainingText = tmp;
    };

    return TypingChar;
})();

/**
 * Handle each typing group that will be separated by a non-typing
 * space. Basically this just proxy to {@link TypingChar}.
 */
var TypingWord = (function() {
    function TypingWord(typingWord) {
        this.typing = typingWord;
        var typingList = Kana.splitKana(typingWord);
        var typingItem = [];
        typingList.forEach(function (c) {
            typingItem.push(new TypingChar(c));
        });
        this.typingItem = typingItem;
        this.currentItem = 0;
    }

    TypingWord.prototype.accept = function (c) {
        if (this.isComplete())
            return false;

        // TODO make backward fallback too for sequence of same character
        var accept = this.typingItem[this.currentItem].accept(c);

        if (accept >= 0 && this.typingItem[this.currentItem].isComplete()) {
            this.currentItem++;
        }

        if (accept == -1 && this.currentItem > 0) {
            accept = this.typingItem[this.currentItem-1].accept(c);
        }

        return accept;
    };

    TypingWord.prototype.isComplete = function () {
        return this.currentItem >= this.typingItem.length;
    };

    TypingWord.prototype.getRemainingText = function () {
        var ret = "";
        this.typingItem.forEach(function (i) {
            ret += i.getRemainingText();
        });
        return ret;
    };

    return TypingWord;
})();

/**
 * Main typing class, but basically just proxy to {@link TypingWord}.
 * The reason we need three classes for this is because Japanese IME
 * input is complex.
 */
var Typing = (function() {
    function Typing(typing) {
        this.typing = typing;
        var typingWords = [];
        typing.forEach(function (c) {
            typingWords.push(new TypingWord(c));
        });
        this.typingWords = typingWords;
        this.currentWord = 0;
    }

    Typing.prototype.accept = function (c) {
        if (this.isComplete())
            return false;

        // TODO make the input across word boundary like in TypingWord
        var accept = this.typingWords[this.currentWord].accept(c);
        if (accept >= 0 && this.typingWords[this.currentWord].isComplete()) {
            this.currentWord++;
        }

        return accept;
    };

    Typing.prototype.isComplete = function () {
        return this.currentWord >= this.typingWords.length;
    };

    Typing.prototype.getTypingList = function () {
        var ret = [];
        this.typingWords.forEach(function (i) {
            if (!i.isComplete())
                ret.push(i.getRemainingText().replace(/ /g, "_").toUpperCase());
        });
        return ret;
    };

    Typing.prototype.getCharLeft = function () {
        var ret = 0;
        this.typingWords.forEach(function (i) {
            if (!i.isComplete())
                ret += i.getRemainingText().length;
        });
        return ret;
    };

    Typing.prototype.getNextChar = function () {
        var ret = 0;
        this.typingWords.forEach(function (i) {
            if (!i.isComplete() && ret == 0)
                ret = i.getRemainingText().charAt(0);
        });
        return ret;
    };

    return Typing;
})();

/**
 * Handle everything song-related
 */
var Song = (function() {
    function Song(json, basePath) {
        this.data = json;
        this.basePath = basePath;
        this.audio = null;
        this.image = null;
        this.event = null;

        this.id = json.id;

        this.currentVerse = -1;
        this.typing = null;
        this.typings = [];
        this.typingLeftChar = 0;

        this.charCount = 0;

        this.isPlaying = false;
        this.isLoaded = false;

        this.isLyricsLoaded = false;
        this.isAudioLoaded = false;
        this.isLyricsLoading = false;
        this.isAudioLoading = false;
        this.isLyricsError = false;
        this.isAudioError = false;
        this.audioLoadingProgress = 0;
        this.lyricsLoadingProgress = 0;
        this.imageLoading = false;

        this.time = 0;
        this.duration = -1;
    }

    Song.prototype.handleKey = function (input) {
        if (this.typing != null) {
            return this.typing.accept(input);
        }
        return false;
    };

    Song.prototype.getTypingList = function () {
        if (this.typing != null)
            return this.typing.getTypingList();
        return [];
    };

    Song.prototype.tick = function () {
        if (!this.isPlaying)
            return false;

        var ret = false;
        var time = this.audio.getPosition();
        this.time = time;

        if (this.currentVerse == -1 || (this.currentVerse < this.getLineCount() && time >= this.event[this.currentVerse]["end"])) {
            this.currentVerse++;

            if (this.typing != null) {
                this.typingLeftChar = this.typing.getCharLeft();
            }

            this.typing = this.typings[this.currentVerse];
            ret = true;
        }

        return ret;
    };

    Song.prototype.processTyping = function () {
        this.charCount = 0;
        if (this.event == null)
            return;
        for (var i = 0; i < this.event.length; i++) {
            if (!this.isBlank(i)) {
                this.typings[i] = new Typing(this.getTyping(i));
                this.charCount += this.typings[i].getCharLeft();
            } else {
                this.typings[i] = null;
            }
        }
    };

    Song.prototype.getCurrentVerse = function () {
        if (!this.isInSong(this.currentVerse) || this.isBlank(this.currentVerse)) {
            return {
                "lyrics": "",
                "typing": []
            };
        } else {
            return {
                "lyrics": this.getLyric(this.currentVerse),
                "typing": this.getTyping(this.currentVerse)
            };
        }
    };

    Song.prototype.getNextVerse = function () {
        if (!this.isInSong(this.currentVerse+1) || this.isBlank(this.currentVerse+1))
            return {
                "lyrics": "",
                "typing": []
            };
        else
            return {
                "lyrics": this.getLyric(this.currentVerse+1),
                "typing": this.getTyping(this.currentVerse+1)
            };
    };

    Song.prototype.getTimeUntilNextLine = function () {
        if (this.currentVerse < this.getLineCount()) {
            return this.event[this.currentVerse]["end"] - this.getTime();
        } else {
            return this.getDuration() - this.getTime();
        }
    };

    Song.prototype.getCurrentSectionTime = function () {
        if (this.currentVerse >= this.getLineCount())
            return 0;
        return this.event[this.currentVerse]["end"] - this.event[this.currentVerse]["start"];
    };

    Song.prototype.getTime = function () {
        return this.time;
    };

    Song.prototype.getDuration = function() {
        if (this.duration == -1)
            this.duration = this.audio.getDuration();
        return this.duration;
    };

    Song.prototype.getProgress = function () {
        return this.getTime() / this.getDuration();
    };

    Song.prototype.getLineCount = function() {
        return this.event.length;
    };

    Song.prototype.isBlank = function (line) {
        if (!this.isInSong(line))
            return true;
        return "blank" in this.event[line] && this.event[line]['blank'];
    };

    Song.prototype.isInSong = function (line) {
        return 0 <= line && line < this.getLineCount();
    };

    Song.prototype.isComplete = function () {
        return this.currentVerse == this.getLineCount();
    };

    Song.prototype.getLyric = function (line) {
        if (this.isBlank(line))
            return "";

        return this.event[line]["lyric"];
    };

    Song.prototype.getTyping = function (line) {
        if (this.isBlank(line))
            return [];

        if ("typing" in this.event[line])
            return this.event[line]["typing"];

        // Return lyric in no typing available
        return [this.event[line]["lyric"]];
    };

    Song.prototype.getData = function (info) {
        var key = info + "-" + Graphics.language;

        if (key in this.data)
            return this.data[key];

        key = info + "-en";
        if (key in this.data)
            return this.data[key];

        key = info + "-jp";
        if (key in this.data)
            return this.data[key];

        key = info;
        if (key in this.data)
            return this.data[key];

        key = info.substring(0, info.length-3);
        if (key in this.data)
            return this.data[key];

        return "";
    };

    Song.prototype.getAudioURL = function () {
        return this.basePath + '/' + this.data['file'];
    };

    Song.prototype.getLyricsURL = function () {
        return this.basePath + '/' + this.data['lyrics'];
    };

    Song.prototype.getAudioLoadProgress = function () {
        return this.audioLoadingProgress;
    };

    Song.prototype.getLyricsLoadProgress = function () {
        return this.lyricsLoadingProgress;
    };

    Song.prototype.isReady = function() {
        return this.audio != null && this.isLoaded;
    };

    Song.prototype.play = function () {
        if (!this.isLoaded || this.audio == null)
            return false;

        if (!this.isPlaying)
            this.audio.play();

        this.isPlaying = true;
        return true;
    };

    Song.prototype.stop = function () {
        if (this.isPlaying)
            this.audio.stop();
        if (this.isLoading)
            this.cancel();

        this.currentVerse = -1;
        this.typing = null;
        this.isPlaying = false;
        this.isLoading = false;
        this.typingLeftChar = 0;
        this.time = 0;

        this.processTyping();
    };

    Song.prototype.load = function () {

        var _this = this;

        /* Clear previous failed attempts if any */
        if (this.isLyricsError) {
            this.isLyricsError = false;
            AssetManager.remove(this.id + "_lyrics", true);
        }

        if (this.isAudioError) {
            this.isAudioError = false;
            AssetManager.remove(this.id + "_audio", true);
        }

        // Load Lyric if not loaded
        if (!this.isLyricsLoaded && !this.isLyricsLoading && !this.isLyricsError) {
            console.log("Begin loading lyrics...");

            AssetManager.load(Loader.json, this.id + "_lyrics", this.getLyricsURL(), function (result) {
                _this.isLyricsLoaded = true;
                _this.isLyricsLoading = false;
                _this.lyricsLoadingProgress = 1;
                _this.event = result;
                console.log("Lyrics " + _this.id + " loaded.");

                if (_this.isLyricsLoaded && _this.isAudioLoaded) {
                    _this.isLoaded = true;
                }

                _this.processTyping();
            }, true, function (progress) {
                _this.lyricsLoadingProgress = progress;
            }, function () {
                _this.isLyricsError = true; // error
                _this.isLyricsLoaded = false;
                _this.isLyricsLoading = false;
                console.log("Lyrics " + _this.id + " load error.");
            });

            this.isLyricsLoading = true;
        }

        // Load Audio if not loaded
        if (!this.isAudioLoaded && !this.isAudioLoading && !this.isAudioError) {
            console.log("Begin loading song...", this.getAudioURL());

            AssetManager.load(Loader.music, this.id + "_audio", this.getAudioURL(), function (response) {
                console.log("Here2");
                _this.isAudioLoaded = true;
                _this.isAudioLoading = false;
                _this.audioLoadingProgress = 1;
                _this.audio = new BasicSound(response);
                console.log("Song " + _this.id + " loaded.");

                if (_this.isLyricsLoaded && _this.isAudioLoaded) {
                    _this.isLoaded = true;
                }
            }, true, function (progress) {
                _this.audioLoadingProgress = progress;
                console.log(progress);
            }, function () {
                _this.isAudioError = true; // error
                _this.isAudioLoaded = false;
                _this.isAudioLoading = false;
                console.log("Song " + _this.id + " load error.");
            });

            this.isAudioLoading = true;
        }

        return true;
    };

    Song.prototype.cancel = function () {
        AssetManager.remove(this.key + "_audio");
        AssetManager.remove(this.key + "_lyrics");
    };

    Song.prototype.loadImage = function () {
        if (this.imageLoading)
            return;

        this.imageLoading = true;
        var _this = this;
        AssetManager.load(Loader.image, this.id + "_image", this.basePath + '/' + this.data['image'], function (response) { // TODO add load type
            try {
                _this.image = new Image(response, 0, 0, 1280, 720);
                _this.image.z(10);
            } catch (_) {
                _this.image = new Image(BACKGROUND, 0, 0, 1280, 720);
            }
        }, true, undefined, function (_) {
            _this.image = new Image(BACKGROUND, 0, 0, 1280, 720);
        });
    };

    return Song;
})();

/// ///////////////////////
/// Other Engine

/**
 * Store current game state and facilitate the state transition.
 */
var State = (function() {
    function State() {}

    // List of available states
    State.PRELOAD = 0;
    State.MENU    = 1;
    State.PRESONG = 2;
    State.SONG    = 3;
    State.SCORE   = 4;

    State.current = State.PRELOAD;
    State.transitioning = false;

    State.is = function (c) {
        return c == State.current;
    };

    State.to = function (state) {
        if (state < 0 && state > 4) {
            return;
        }

        if (State.transitioning)
            return;

        var callback = function () {
            State.transitioning = false;
            State.current = state;
            switch (state) {
                // No State.PRELOAD because nothing should transit to
                // that state
                case State.MENU:
                    MenuScreen.onIn();
                    break;
                case State.PRESONG:
                    PresongScreen.onIn();
                    break;
                case State.SONG:
                    SongScreen.onIn();
                    break;
                case State.SCORE:
                    ScoreScreen.onIn();
                    break;
            }
        };

        State.transitioning = true;
        switch (State.current) {
            case State.PRELOAD:
                PreloadScreen.onOut(callback);
                break;
            case State.MENU:
                MenuScreen.onOut(callback);
                break;
            case State.PRESONG:
                PresongScreen.onOut(callback);
                break;
            case State.SONG:
                SongScreen.onOut(callback);
                break;
            case State.SCORE:
                ScoreScreen.onOut(callback);
                break;
        }
    };

    return State;
})();

/**
 * Manage songs list and various utilities
 */
var SongManager = (function() {
    function SongManager() {}

    // List of available song
    SongManager.songs = {};

    // Current song
    SongManager.song = null;

    SongManager.initSongData = function (songData) {
        PreloadScreen.loadFile(Loader.json, "song_" + songData + "_data", songData + "/_index.json", function (result) {
            if (result['folder']) {
                result['folder'].forEach(function (c) {
                    SongManager.initSongData(songData + "/" + c);
                });
            }

            if (result['file']) {
                result['file'].forEach(function (c) {
                    var id = "song_" + c + "_data";
                    PreloadScreen.loadFile(Loader.json, id, c, function(result) {
                        if (result != null) {
                            var key = result.id;
                            var basePath = SongManager.basePath(c);
                            SongManager.songs[key] = new Song(result, basePath);
                        } else {
                            console.log("wrf: ");
                        }
                    });
                });
            }
        });
    };

    SongManager.basePath = function (path) {
        var paths = path.split('/');
        paths.pop();
        return paths.join('/');
    };

    SongManager.tick = function () {
        if (SongManager.song != null) {
            SongManager.song.tick();
        }
    };

    // Return current song if no id is specified,
    // or return song with provided id.
    SongManager.getSong = function (id) {
        if (id == undefined)
            return SongManager.song;
        return SongManager.songs[id];
    };

    SongManager.setSong = function (song) {
        if (SongManager.song != null)
            SongManager.song.stop();
        SongManager.song = song;
    };

    SongManager.formatTime = function (time) {
        var m = Math.floor(time/60000);
        var s = Math.floor(time/1000)%60;

        var ret = "" + m + ":";
        if (s < 10) ret += "0" + s;
        else        ret += "" + s;

        return ret;
    };

    SongManager.combineTyping = function (typing) {
        var ret = "";
        typing.forEach(function (c) {
            ret += c;
        });

        return ret;
    };

    return SongManager;
})();

/**
 * Manage assets preloading and callback
 */
var AssetManager = (function() {
    function AssetManager() {}

    //AssetManager.queue = new createjs.LoadQueue();
    //AssetManager.queue.installPlugin(createjs.Sound);
    AssetManager.status = {};
    this.complete = true;
    this.count = 0;

    AssetManager.load = function (type, id, src, callback, start, progressCallback, errorCallback) {
        if (start == undefined)
            start = true;
        if (id in AssetManager.status) {
            AssetManager.status[id].loader.then(function(obj) {
                AssetManager.count--;
                if (AssetManager.count == 0)
                    AssetManager.complete = true;
                AssetManager.status[id].status = 1;
                if (callback)
                    callback(obj);
            }, errorCallback, function(evt) {
                if (evt.lengthComputable && progressCallback) {
                    progressCallback(evt.loaded/evt.total); // TODO check correctness
                }
            }).then(null, function (e) { console.error(e); });
            return;
        }

        var loader = type("get", src + "?version=" + encodeURIComponent(VERSION));

        loader.then(function(obj) {
            AssetManager.count--;
            if (AssetManager.count == 0)
                AssetManager.complete = true;
            AssetManager.status[id].status = 1;
            callback(obj);
        }, errorCallback, function(evt) {
            if (evt.lengthComputable && progressCallback) {
                progressCallback(evt.loaded/evt.total); // TODO check correctness
            }
        }).then(null, function (e) { console.error(e); });

        AssetManager.status[id] = {
            status: 0,
            src: src,
            loader: loader,
            callback: callback,
            progress: progressCallback,
            error: errorCallback
        };

        AssetManager.count++;
        AssetManager.complete = false;

        //if (start)
            loader.send();
    };

    AssetManager.remove = function (id, hard) {
        if (id in AssetManager.status && AssetManager.status[id].status != 1) {
            AssetManager.status[id].xhr.abort();
            delete AssetManager.status[id];
            return true;
        }
        if (hard != undefined && hard) {
            AssetManager.status[id].xhr.abort();
            delete AssetManager.status[id];
            return true;
        }
        return false;
    };

    AssetManager.isComplete = function (id) {
        if (id in AssetManager.status) {
            return AssetManager.status[id].status == 1;
        }
        return false;
    };

    return AssetManager;
})();

/**
 * Keycode mapping utilities
 */
var KeyCode = (function() {
    function KeyCode() {}

    KeyCode.map = [
        [188, ','    ],
        [189, '-'    ],
        [190, '.'    ],
        [191, '/'    ],
        [220, '\\'   ],
        [222, '\''   ],
        [ 27, 'Esc'  ],
        [ 38, 'Up'   ],
        [ 40, 'Down' ],
        [ 37, 'Left' ],
        [ 39, 'Right'],
        [ 13, 'Enter'],
        [  8, 'Backspace'],
        [  9, 'Tab'  ],
        [ 33, 'PgUp' ],
        [ 34, 'PgDown']
    ];

    KeyCode.fromKeyCode = function (code, shift) {
        var input = '';
        if (code == 32) {
            input = ' ';
        } else if ((code >= 65 && code <= 90) || (code >= 48 && code <= 57)) {
            input = String.fromCharCode(code).toLowerCase();
        } else if (code >= 96 && code <= 105) { // Numpad
            input = String.fromCharCode(code-48).toLowerCase();
        } else if (code == 191 && shift) { //special case with shift
            input = '?';
        } else KeyCode.map.forEach(function (c) {
            if (c[0] == code)
                input = c[1];
        });

        return input;
    };

    KeyCode.toKeyCode = function (input) {
        input = input.toUpperCase();
        var code = input.charCodeAt(0);
        if (input == ' ') {
            code = 32;
        } else if ((code >= 65 && code <= 90) || (code >= 48 && code <= 57)) {
            // code = code
        } else if (input == '?') {
            code = 191;
        } else KeyCode.map.forEach(function (c) {
            if (c[1] == input)
                code = c[0];
        });
        return code;
    };

    KeyCode.toKeyShift = function (input) {
        return input == '?';
    };

    return KeyCode;
})();

/**
 * Use AMD loader
 */
var Kana = require('kanatable');

/**
 * Autoplay class --- for cheating since every game need one
 */
var AutoPlay = (function() {
    function AutoPlay() {}

    AutoPlay.active = false;
    AutoPlay.lastType = 0;
    AutoPlay.interval = 1000;
    AutoPlay.currentVerse = -1;

    AutoPlay.konami = ["Up", "Down", "Down", "Left", "Right", "Left", "Right", "b", "a"];
    AutoPlay.current = 0;

    AutoPlay.begin = function () {
        AutoPlay.active = true;
        AutoPlay.current = 0;
    };

    AutoPlay.stop = function () {
        AutoPlay.active = false;
        AutoPlay.current = 0;
    };

    // Test for konami code
    AutoPlay.handleInput = function (input) {
        if (AutoPlay.current < AutoPlay.konami.length && AutoPlay.konami[AutoPlay.current] == input) {
            AutoPlay.current++;
        } else if (AutoPlay.konami[0] == input) {
            AutoPlay.current = 1;
        } else {
            AutoPlay.current = 0;
        }

        if (AutoPlay.current >= AutoPlay.konami.length) {
            AutoPlay.begin();
            console.log("AutoPlay activated.");
        }

        return AutoPlay.current != 0;
    };

    AutoPlay.tick = function () {
        if (!AutoPlay.active || SongManager.getSong() == null || SongManager.getSong().typing == null) {
            return;
        }

        var song = SongManager.getSong();

        if (AutoPlay.currentVerse != song.currentVerse) {
            AutoPlay.currentVerse = song.currentVerse;
            this.interval = Math.min(song.getTimeUntilNextLine()*0.8 / (song.typing.getCharLeft()+1), 200);
            // This is to prevent typing first character too fast
            AutoPlay.lastType = song.getTime();
        }

        if (song.getTime()-AutoPlay.lastType >= AutoPlay.interval && !song.typing.isComplete()) {
            AutoPlay.lastType += AutoPlay.interval;
            setTimeout(function() {
                var event = $.Event('keydown', { which: KeyCode.toKeyCode(song.typing.getNextChar()), shiftKey: KeyCode.toKeyShift(song.typing.getNextChar()) } );
                $(window).trigger(event);
            }, 5);
        }
    };

    return AutoPlay;
})();

/**
 * Score engine for calculating and storing of score
 */
var ScoreEngine = (function() {
    function ScoreEngine() {}

    ScoreEngine.songStart = function () {
        ScoreEngine.typed = 0;
        ScoreEngine.missed = 0;
        ScoreEngine.completed = 0;
        ScoreEngine.solve = 0;
        ScoreEngine.currentCombo = 0;
        ScoreEngine.maxCombo = 0;
        ScoreEngine.score = 0;
        ScoreEngine.inline = false;

        ScoreEngine.realType = 0;
        ScoreEngine.lastTime = 0;
        ScoreEngine.overallTime = 0;

        ScoreEngine.currentLineScore = 0;
        ScoreEngine.lineChain = 0;
    };

    ScoreEngine.onType = function (result) {
        var currentTime = SongManager.getSong().getTime();

        if (result == -1) {
            ScoreEngine.currentCombo = 0;
            ScoreEngine.missed++;

            // Score deduction
            var dcpm = 60*1000/Math.max(currentTime - ScoreEngine.lastTime, 1);
            ScoreEngine.score -= Math.sqrt(dcpm) * 17.32 * ScoreEngine.getPercent();
            ScoreEngine.score = Math.max(ScoreEngine.score, 0);
        } else {
            // Update CPM
            var dt = currentTime - ScoreEngine.lastTime;
            var dcpm = 60*1000/Math.max(dt, 1);
            ScoreEngine.realType++;
            ScoreEngine.overallTime += dt;
            ScoreEngine.lastTime = currentTime;

            // Score calculation
            // Base score is square root cpm of current typing character
            // Score for current = base + base * (combo*percent) / 16
            // then multiply by result factor (the number of character recognised by typing system for this keydown)
            var base = Math.sqrt(dcpm) * 17.32; // 17.32 is approx sqrt(300)
            var score = result * (base + base*ScoreEngine.currentCombo*ScoreEngine.getPercent()/16);
            ScoreEngine.score += score;
            ScoreEngine.currentLineScore += score;

            // Update stats
            ScoreEngine.currentCombo += result;
            ScoreEngine.typed += result;
            if (ScoreEngine.currentCombo > ScoreEngine.maxCombo)
                ScoreEngine.maxCombo = ScoreEngine.currentCombo;
        }
    };

    ScoreEngine.onLineStart = function () {
        ScoreEngine.inline = true;
        ScoreEngine.lastTime = SongManager.getSong().getTime();
        ScoreEngine.currentLineScore = 0;
    };

    ScoreEngine.onLineEnd = function (left) {
        if (!ScoreEngine.inline)
            return;

        ScoreEngine.inline = false;
        ScoreEngine.solve += left;
        if (left == 0) {
            ScoreEngine.completed++;
            ScoreEngine.lineChain++;

            // Bonus score
            ScoreEngine.score += ScoreEngine.currentLineScore * Math.sqrt(ScoreEngine.lineChain)/2;
        } else {
            // Add left time to typing time
            ScoreEngine.overallTime += SongManager.getSong().getTime() - ScoreEngine.lastTime;

            // Reset Combo
            ScoreEngine.currentCombo = 0;
            ScoreEngine.lineChain = 0;
        }
    };

    ScoreEngine.songEnd = function () {
        // Save score
        var key = 'typingmania_' + SAVE_VERSION + '_' + SongManager.getSong().id;

        var oldData = $.jStorage.get(key, {
            score: 0,
            'class': 'F',
            'update': 0
        });

        if (!AutoPlay.active)
            $.jStorage.set(key, ScoreEngine.forStorage(oldData));
    };

    ScoreEngine.getPercent = function () {
        if (this.missed+this.solve+this.typed == 0)
            return 0;
        return this.typed / (this.missed+this.solve+this.typed);
    };

    ScoreEngine.getPercent2 = function () {
        if (this.missed+this.typed == 0)
            return 0;
        return this.typed / (this.missed+this.typed);
    };

    ScoreEngine.getCPM = function (realtime) {
        if (ScoreEngine.overallTime == 0)
            return 0;

        if (realtime == undefined)
            realtime = true;

        var time = ScoreEngine.overallTime;
        if (ScoreEngine.inline && realtime) {
            time += SongManager.getSong().getTime() - ScoreEngine.lastTime
        }
        return this.realType * 60 * 1000 / (time);
    };

    ScoreEngine.forStorage = function (oldData) {
        var ret = $.extend({}, oldData);
        if (ScoreEngine.score > oldData.score) {
            ret.score = ScoreEngine.score;
            ret.class = ScoreEngine.getClass();
        }
        ret.update = new Date().getTime();
        return ret;
    };

    ScoreEngine.getHighScore = function (song) {
        song = song || SongManager.getSong();
        return $.jStorage.get('typingmania_' + SAVE_VERSION + '_' + song.id, null);
    };

    ScoreEngine.getClass = function () {
        if (AutoPlay.active)
            return 'AUTO';

        var percent = this.getPercent();
        var linePercent = ScoreEngine.typed / SongManager.getSong().charCount;
        if (percent == 1 && linePercent > 0.99) {
            return 'SS';
        } else if ((linePercent > 0.95) && (this.solve == 0 && percent > 0.95)) {
            return 'S';
        } else if ((linePercent > 0.9) && ((this.solve == 0 && percent > 0.90) || percent > 0.95)) {
            return 'A';
        } else if ((linePercent > 0.85) && ((this.solve == 0 && percent > 0.80) || percent > 0.85)) {
            return 'B+';
        } else if ((linePercent > 0.8) && ((this.solve == 0 && percent > 0.70) || percent > 0.8)) {
            return 'B';
        } else if ((linePercent > 0.75) && ((this.solve == 0 && percent > 0.5) || percent > 0.7)) {
            return 'C+';
        } else if ((linePercent > 0.7) && (this.solve == 0 || percent > 0.55)) {
            return 'C';
        } else if ((linePercent > 0.6) && (percent > 0.45)) {
            return 'D+';
        } else if ((linePercent > 0.5) && (percent > 0.35)) {
            return 'D';
        } else if ((linePercent > 0.35) && (percent > 0.2)) {
            return 'E';
        } else {
            return 'F';
        }
    };

    return ScoreEngine;
})();

/// ///////////////////////
/// Graphical

/**
 * Viewport for auto resizing of of element based on browser size.
 *
 * Supports limited to font-size for text and width/height for image only.
 */
var Viewport = (function() {
    function Viewport() {}

    // This is width and height the game component will be located at.
    Viewport.STD_WIDTH = 1280;
    Viewport.STD_HEIGHT = 720;

    Viewport.elements = {};
    Viewport.width = 800;
    Viewport.height = 600;
    Viewport.top = 0;
    Viewport.left = 0;

    Viewport.sketchPercent = 1;

    Viewport.onResize = function () {
        var widthToHeight = Viewport.STD_WIDTH / Viewport.STD_HEIGHT;
        var newWidth = window.innerWidth - 3;
        var newHeight = window.innerHeight - 3;
        var newWidthToHeight = newWidth / newHeight;

        if (newWidthToHeight > widthToHeight) {
            newWidth = newHeight * widthToHeight;
        } else {
            newHeight = newWidth / widthToHeight;
        }

        Viewport.width = newWidth;
        Viewport.height = newHeight;

        Viewport.sketchPercent = newWidth / Viewport.STD_WIDTH;

        Viewport.left = (window.innerWidth - newWidth) / 2;
        Viewport.top = (window.innerHeight - newHeight) / 2;

        Viewport.resizeAll();
    };

    Viewport.position = function (c, jq, data, resizing) {
        if (!(c in Viewport.elements)) {
            data.object = jq;
            Viewport.elements[c] = data;
        }

        var dx = 0, dy = 0;

        if (typeof data.align == "string") {
            var w = $(jq).css('width');
            var h = $(jq).css('height');

            w = w.substring(0, w.length-2);
            h = h.substring(0, h.length-2);

            if (resizing != undefined && resizing) {
                w /= (Viewport.sketchPercent);
                h /= (Viewport.sketchPercent);
            }

            data.align.split(',').forEach(function (c) {
                switch (c) {
                    case 'cx':
                        dx = w/2;
                        break;
                    case 'cy':
                        dy = h/2;
                        break;
                    case 'bx':
                        dx = w;
                        break;
                    case 'by':
                        dy = h;
                        break;
                }
            });
        }

        // Note to my future self
        // shifted variable contain whether to shift the element by the block border margin
        // item INSIDE other div will have shifted=true
        // as defined by LimitedControlGroup

        var css = {
            position: "absolute"
        };
        var shifted = data.shifted == undefined ? true : data.shifted;
        css.left = "" + ((shifted ? Viewport.left : 0) + (data.x-dx) * Viewport.sketchPercent) + "px";
        css.top  = "" + ((shifted ? Viewport.top  : 0) + (data.y-dy) * Viewport.sketchPercent) + "px";
        css["font-size"] = "" + (data.fs * Viewport.sketchPercent) + "px";
        if (data.w != 0 && data.h != 0) {
            css.overflow = "hidden";
            css.width  = "" + (data.w * Viewport.sketchPercent) + "px";
            css.height = "" + (data.h * Viewport.sketchPercent) + "px";
        }
        $(jq).css(css);
    };

    Viewport.resizeAll = function () {
        for (var c in Viewport.elements) {
            if (Viewport.elements.hasOwnProperty(c)) {
                var cc = Viewport.elements[c];
                if (cc.active) {
                    Viewport.position(c, cc.object, cc, true);
                }
            }
        }
    };

    Viewport.resizeElement = function (id) {
        if (id in Viewport.elements) {
            var cc = Viewport.elements[id];
            Viewport.position(id, cc.object, cc, true);
        }
    };

    return Viewport;
})();

/**
 * Base class for all control
 */
var ControlBase = (function() {
    function ControlBase($, position) {
        this.$ = $;
        this.id = this.getID();
        this.parent = null;

        this.attr('id', this.id);
        this.css('display', 'none');

        this.parentElement = jQuery('body');
        this.inDom = false;

        this.position = $.extend({}, {
            x: 0,
            y: 0,
            w: 0,
            h: 0,
            fs: 0,
            align: '',
            active: false
        }, position || {});
        this.drawPosition = $.extend({}, this.position);
        Viewport.position(this.id, this.$, this.drawPosition);
    }

    ControlBase._uniqueid = {};

    ControlBase.prototype.getControlName = function () {
        return 'ControlBase';
    };

    ControlBase.prototype.setPosition = function (x, y) {
        this.position.x = x;
        this.position.y = y;

        this.recalculate();
    };

    ControlBase.prototype.setAlign = function (align) {
        this.position.align = align;
        this.recalculate();
    };

    ControlBase.prototype.setSize = function (w, h) {
        var ratio;
        if (w == 0 && h == 0) {
            return false;
        } else if (w == 0) {
            ratio = h / this.position.h;
            this.position.w *= ratio;
            this.position.h = h;
        } else if (h == 0) {
            ratio = w / this.position.w;
            this.position.w = w;
            this.position.h *= ratio;
        } else {
            ratio = Math.min(w / this.position.w, h / this.position.h);
            this.position.w = w;
            this.position.h = h;
        }
        this.position.fs *= ratio;

        this.recalculate();
        return true;
    };

    ControlBase.prototype.recalculate = function () {
        if (this.parent != null) {
            this.parent.recalculateChild(this);
        } else {
            $.extend(this.drawPosition, this.position);
        }
        this.shouldResize();
    };

    ControlBase.prototype.shouldResize = function () {
        Viewport.resizeElement(this.id);
        var id = this.id;
        setTimeout(function () {
            Viewport.resizeElement(id);
        }, 10);
    };

    ControlBase.prototype.getID = function () {
        if (this.id != undefined) {
            return this.id
        }

        var controlName = this.getControlName();
        var controlUnique = 0;

        if (controlName in ControlBase._uniqueid) {
            controlUnique = ControlBase._uniqueid[controlName];
            ControlBase._uniqueid[controlName]++;
        } else {
            ControlBase._uniqueid[controlName] = controlUnique+1;
        }

        return "control_" + controlName + "_unique_" + controlUnique;
    };

    ControlBase.prototype.html = function (html) {
        var ret;
        if (html == undefined)
            ret = this.$.html();
        else
            ret = this.$.html(html);
        this.shouldResize();
        return ret;
    };

    ControlBase.prototype.txt = function (text) {
        var ret;
        if (text == undefined)
            ret = this.$.text();
        else
            ret = this.$.text(text);
        this.shouldResize();
        return ret;
    };

    ControlBase.prototype.css = function (css, data) {
        var ret;
        if (data == undefined)
            ret = this.$.css(css);
        else
            ret = this.$.css(css, data);
        this.shouldResize();
        return ret;
    };

    ControlBase.prototype.attr = function (attr, data) {
        var ret;
        if (data == undefined)
            ret = this.$.attr(attr);
        else
            ret = this.$.attr(attr, data);
        this.shouldResize();
        return ret;
    };

    ControlBase.prototype.z = function (z) {
        this.$.css('z-index', z);
        return this;
    };

    ControlBase.prototype.show = function () {
        if (!this.inDom)
            this.attach();
        var ret = this.$.show();
        this.shouldResize();
        return ret;
    };

    ControlBase.prototype.hide = function () {
        if (this.inDom)
            this.detach();
        return this.$.hide();
    };

    ControlBase.prototype.fadeIn = function (speed, complete) {
        if (!this.inDom)
            this.attach();
        var ret = this.$.fadeIn(speed, complete);
        this.shouldResize();
        return ret;
    };

    ControlBase.prototype.fadeOut = function (speed, complete) {
        var _this = this;
        return this.$.fadeOut(speed, function () {
            _this.detach();
            if (complete != undefined)
                complete();
        });
    };

    ControlBase.prototype.visible = function () {
        return this.css('display') != 'none' && this.inDom;
    };

    ControlBase.prototype.stopResizing = function () {
        this.drawPosition.active = false;
    };

    ControlBase.prototype.startResizing = function () {
        this.drawPosition.active = true;
        this.shouldResize();
    };

    ControlBase.prototype.detach = function () {
        if (this.inDom) {
            this.parentElement = this.$.parent();
            this.stopResizing();
            this.inDom = false;
            return this.$.detach();
        }
        return this;
    };

    ControlBase.prototype.attach = function ($) {
        if (!this.inDom) {
            this.startResizing();
            this.inDom = true;
            if ($ == undefined)
                this.$.appendTo(this.parentElement);
            else
                this.$.appendTo($);
            return this;
        }
        return this;
    };

    return ControlBase;
})();

/**
 * Group of control that can be resized and relocated together.
 *
 * Why have both this and limited version, you ask? This is to allow
 * box-shadow to be set for Progressbar, otherwise it will be hidden.
 */
var ControlGroup = (function($super) {
    $extends(ControlGroup, $super);

    function ControlGroup(x, y, w, h) {
        this.id = this.getID();

        this.parent = null;
        this.children = [];

        this.parentElement = $('body');
        this.inDom = false;

        this.position = {
            w: w,
            h: h,
            x: x,
            y: y,
            fs: 0,
            align: '',
            active: false
        };

        this.hRatio = 1;
        this.wRatio = 1;

        this.drawPosition = $.extend({}, this.position);
    }

    ControlGroup.prototype.getControlName = function () {
        return "ControlGroup";
    };

    ControlGroup.prototype.add = function (c) {
        c.parent = this;

        // HACK
        if (c instanceof LimitedControlGroup)
            c.block.parent = this;

        this.children.push(c);
        c.recalculate();

        return this;
    };

    ControlGroup.prototype.setSize = function (w, h) {
        var oldW = this.position.w;
        var oldH = this.position.h;

        $super.prototype.setSize.call(this, w, h);

        this.hRatio *= this.position.h / oldH;
        this.wRatio *= this.position.w / oldW;

        this.recalculate();
    };

    ControlGroup.prototype.recalculate = function () {
        $super.prototype.recalculate.call(this);
        this.recalculateChildren();
    };

    ControlGroup.prototype.recalculateChildren = function () {
        this.children.forEach(function (c) {
            c.recalculate();
        });
    };

    ControlGroup.prototype.recalculateChild = function (c) {
        c.drawPosition.x = c.position.x + this.position.x;
        c.drawPosition.y = c.position.y + this.position.y;

        var hRatio = this.drawPosition.h / this.position.h;
        var wRatio = this.drawPosition.w / this.position.w;

        c.drawPosition.h = c.position.h * hRatio * this.hRatio;
        c.drawPosition.w = c.position.w * wRatio * this.wRatio;
        c.drawPosition.fs = c.position.fs * Math.min(hRatio, wRatio) * Math.min(this.hRatio, this.wRatio);

        if (this.position.shifted === false) {
            c.drawPosition.shifted = false;
            c.position.shifted = false;
        }

        c.shouldResize();
    };

    ControlGroup.prototype.shouldResize = function () {
        // Nothing, but must override parent method
    };

    ControlGroup.prototype.html = function (html) {
        this.children.forEach(function (c) {
            c.html(html);
        });
        this.recalculateChildren();
        return this;
    };

    ControlGroup.prototype.txt = function (text) {
        this.children.forEach(function (c) {
            c.txt(text);
        });
        this.recalculateChildren();
        return this;
    };

    ControlGroup.prototype.css = function (css, data) {
        this.children.forEach(function (c) {
            if (data == undefined)
                c.css(css);
            else
                c.css(css, data);
        });
        this.recalculateChildren();
        return this;
    };

    ControlGroup.prototype.attr = function (attr, data) {
        this.children.forEach(function (c) {
            if (data == undefined)
                c.attr(attr);
            else
                c.attr(attr, data);
        });
        this.recalculateChildren();
        return this;
    };

    ControlGroup.prototype.z = function (z) {
        this.css('z-index', z);
        return this;
    };

    ControlGroup.prototype.show = function () {
        this.children.forEach(function (c) {
            c.show();
        });
        return this;
    };

    ControlGroup.prototype.hide = function () {
        this.children.forEach(function (c) {
            c.hide();
        });
        return this;
    };

    ControlGroup.prototype.fadeIn = function (speed, complete) {
        var count = 0;
        var target = this.children.length;
        var callback = function () {
            count++;
            if (count == target && complete != undefined)
                complete();
        };
        this.children.forEach(function (c) {
            c.fadeIn(speed, callback);
        });
        return this;
    };

    ControlGroup.prototype.fadeOut = function (speed, complete) {
        var count = 0;
        var target = this.children.length;
        var callback = function () {
            count++;
            if (count == target && complete != undefined)
                complete();
        };
        this.children.forEach(function (c) {
            c.fadeOut(speed, callback);
        });
        return this;
    };

    ControlGroup.prototype.visible = function () {
        return true;
    };

    ControlGroup.prototype.detach = function () {
        this.children.forEach(function (c) {
            c.detach();
        });
        return this;
    };

    ControlGroup.prototype.attach = function ($) {
        this.children.forEach(function (c) {
            c.attach($);
        });
        return this;
    };

    ControlGroup.prototype.stopResizing = function () {
        this.children.forEach(function (c) {
            c.stopResizing();
        });
    };

    ControlGroup.prototype.startResizing = function () {
        this.children.forEach(function (c) {
            c.startResizing();
        });
    };

    return ControlGroup;
})(ControlBase);

/**
 * Like ControlGroup, but all its children stay inside a DIV
 * to hide all overflow. Make this much more complex.
 */
var LimitedControlGroup = (function ($super) {
    $extends(LimitedControlGroup, $super);

    function LimitedControlGroup(x, y, w, h) {
        $super.call(this, 0, 0, w, h);
        this.block = new Block(x, y, w, h);
        this.block.css('overflow', 'hidden');
        this.block.attr('class', this.id);
        this.position.shifted = false;
    }

    LimitedControlGroup.prototype.recalculate = function () {
        $super.prototype.recalculate.call(this);
        this.block.recalculate();
    };

    LimitedControlGroup.prototype.setAlign = function (align) {
        this.block.setAlign(align);
    };

    LimitedControlGroup.prototype.setPosition = function (x, y) {
        return this.block.setPosition(x, y);
    };

    LimitedControlGroup.prototype.setSize = function (w, h) {
        this.block.setSize(w, h);
        return $super.prototype.setSize.call(this, w, h);
    };

    LimitedControlGroup.prototype.add = function (c) {
        c.detach();
        c.attach(this.block.$);
        c.show();
        return $super.prototype.add.call(this, c);
    };

    LimitedControlGroup.prototype.z = function (z) {
        this.block.css('z-index', z);
        return this;
    };

    LimitedControlGroup.prototype.show = function () {
        this.block.show();
        this.startResizing();
        return this;
    };

    LimitedControlGroup.prototype.hide = function () {
        this.block.hide();
        this.stopResizing();
        return this;
    };

    LimitedControlGroup.prototype.fadeIn = function (speed, complete) {
        this.startResizing();
        this.block.fadeIn(speed, complete);
        return this;
    };

    LimitedControlGroup.prototype.fadeOut = function (speed, complete) {
        var _this = this;
        this.block.fadeOut(speed, function () {
            _this.stopResizing();
            if (complete != undefined)
                complete();
        });
        return this;
    };

    LimitedControlGroup.prototype.visible = function () {
        return this.block.css('display') != 'none';
    };

    LimitedControlGroup.prototype.stopResizing = function () {
        this.children.forEach(function (c) {
            c.stopResizing();
        });
        this.block.stopResizing();
    };

    LimitedControlGroup.prototype.startResizing = function () {
        this.children.forEach(function (c) {
            c.startResizing();
        });
        this.block.startResizing();
    };

    LimitedControlGroup.prototype.detach = function () {
        this.block.detach();
        this.stopResizing();
        return this;
    };

    LimitedControlGroup.prototype.attach = function ($) {
        this.block.attach($);
        this.startResizing();
        return this;
    };

    return LimitedControlGroup;
})(ControlGroup);

/**
 * Text label object
 */
var Text = (function($super) {
    $extends(Text, $super);

    function Text(text, fs, x, y, color, mode) {
        $super.call(this, $('<span></span>'), {
            x: x,
            y: y,
            fs: fs,
            align: mode
        });

        this.text = text;
        this.html(text);

        if (color != undefined)
            this.css('color', color);
    }

    Text.prototype.getControlName = function () {
        return "Text";
    };

    return Text;
})(ControlBase);

/**
 * Image object
 */
var Image = (function($super) {
    $extends(Image, $super);

    function Image(src, x, y, w, h) {
        var img = null;
        this.src = src;

        // If id is provided, load from preloaded queue
        //if (src in AssetManager.status && AssetManager.status[src].status == 1) {
        //    img = $(AssetManager.queue.getResult(src)); // TODO fix this
        //} else {
        //    img = $('<img />');
        //    img.attr('src', src);
        //}
        if (src instanceof HTMLImageElement)
            img = $(src);
        else {
            img = $('<img />');
            img.attr('src', src);
        }

        $super.call(this, img, {
            x: x,
            y: y,
            w: w,
            h: h
        });
    }

    Image.prototype.src = function (src) {
        return this.$.attr('src', src);
    };

    Image.prototype.getControlName = function () {
        return "Image";
    };

    return Image;
})(ControlBase);

/**
 * Just simple DIV block
 */
var Block = (function($super) {
    $extends(Block, $super);

    function Block(x, y, w, h, color) {
        $super.call(this, $('<div></div>'), {
            x: x,
            y: y,
            w: w,
            h: h
        });

        if (color != undefined)
            this.css('background-color', color);
    }

    Block.prototype.getControlName = function () {
        return "Block";
    };

    return Block;
})(ControlBase);

/**
 * Progressbar
 */
var Progressbar = (function($super){
    $extends(Progressbar, $super);

    function Progressbar(x, y, w, h, color_bar, color_back) {
        $super.call(this, x, y, w, h);
        this.back = new Block(0, 0, w, h, color_back || 'rgba(0, 0, 0, 0)');
        this.bar = new Block(0, 0, 0.0000001*w, h, color_bar);
        this.add(this.back);
        this.add(this.bar);
    }

    Progressbar.prototype.getControlName = function () {
        return "Progressbar";
    };

    Progressbar.prototype.progress = function (p) {
        this.bar.setSize(Math.max(0.0000001, p)*this.back.position.w, this.back.position.h);
    };

    return Progressbar;
})(ControlGroup);

/**
 * Main (shared) graphic component, like font and windows background
 */
var Graphics = (function() {
    function Graphics() {}

    Graphics.fontLoaded = false;
    Graphics.language   = 'en';

    Graphics.select = null;
    Graphics.decide = null;
    Graphics.complete = null;

    Graphics.song_overlay = null;

    Graphics.init = function () {
        // Global setting
        $('body').css('background-color', 'black');

        // Font load
        var NUMBER_OF_FONT = 6;
        //noinspection JSUnusedGlobalSymbols
        WebFont.load({
            custom: {
                families: ['Droid Sans', 'Droid Serif', 'Junge', 'Open Sans:400,600,700'],
                urls: ['data/fonts/fonts.css']
            },
            active: function () {
                Graphics.fontLoaded = true;
            },
            fontactive: function () {
                Viewport.resizeAll();
                PreloadScreen.completedItem++;
            },
            fontinactive: function () {
                PreloadScreen.completedItem++;
            },
            timeout: 10000
        });
        PreloadScreen.numberOfItem += NUMBER_OF_FONT;

        // Create overlay to prevent accidental text selection
        var superOverlay = new Block(0, 0, 1280, 720);
        superOverlay.z(9999);
        superOverlay.show();
    };

    return Graphics;
})();

/// ///////////////////////
/// Game Screen

/*
 * Note on Layering of Screen (z-index)
 * Type                    Lower    Upper
 * ----------------------------------------
 * Main Background                  -1000
 * Preload Screen              1        9
 * Dynamic Background         10       19
 * Song Info                  20       29
 * Menu Screen                30       49
 * Presong Screen             50       74
 * Score Screen               75       99
 * Song Screen               100     1000
 * Final Overlay            9999
 * Mouse-sensitive content 10000
 */

var PreloadScreen = (function() {
    function PreloadScreen() {}

    PreloadScreen.numberOfItem = 0;
    PreloadScreen.completedItem = 0;
    PreloadScreen.currentItem = 0;
    PreloadScreen.donnable = false;
    PreloadScreen.displayed = false;
    PreloadScreen.currentProgress = 0;
    PreloadScreen.done = false;

    PreloadScreen.control = new LimitedControlGroup(0, 0, 1280, 720);

    PreloadScreen.onIn = function () {
        PreloadScreen.loadingText = new Text("Loading...", 60, 640, 355, "white", 'cx,cy');
        PreloadScreen.loadingText.z(5);
        PreloadScreen.loadingText
            .css('font-family', 'Junge')
            .css('letter-spacing', '0.1em')
            .css('text-shadow', '0px 0px 20px #6f6, 0px 0px 20px #9f9');

        PreloadScreen.progressbar = new Progressbar(0, 355, 1280, 5, 'rgba(100, 255, 100, 0.5)');
        PreloadScreen.progressbar.bar.css('box-shadow', '0px 0px 20px 3px rgba(100, 255, 100, 0.5)');
        PreloadScreen.progressbar.z(1);

        PreloadScreen.detailText = new Text("Press Spacebar to Continue", 28, 640, 430, "white", "cx,cy");
        PreloadScreen.detailText.z(5);
        PreloadScreen.detailText
            .css('font-family', 'Junge')
            .css('letter-spacing', '0.1em')
            .css('text-shadow', '0px 0px 20px #6f6, 0px 0px 20px #9f9');

        PreloadScreen.creditText = new Text(
            "TypingMania Game Engine &copy; 2013 under the term of MIT License. " +
            "All medias are properties of the original owners, and are available here for entertainment purpose only. "
            , 10, 10, 720-25, "white", "by");
        PreloadScreen.creditText.z(5);
        PreloadScreen.creditText.css('font-family', 'Droid Sans');

        PreloadScreen.creditText2 = new Text(
            "By entering the game, you agree to be held responsible for anything action you do, including, but not limit to, downloading of illegal music file. " +
            "The author of this website cannot be claimed responsible on any case."
            , 10, 10, 720-10, "white", "by");
        PreloadScreen.creditText2.z(5);
        PreloadScreen.creditText2.css('font-family', 'Droid Sans');

        PreloadScreen.creditText3 = new Text("For more information please see about page.", 10, 10, 720-40, "white", "by");
        PreloadScreen.creditText3.z(5);
        PreloadScreen.creditText3.css('font-family', 'Droid Sans');

        PreloadScreen.control
            .add(PreloadScreen.loadingText)
            .add(PreloadScreen.progressbar)
            .add(PreloadScreen.creditText)
            .add(PreloadScreen.creditText2)
            .add(PreloadScreen.creditText3);

        PreloadScreen.control.attach();
        PreloadScreen.control.show();

        PreloadScreen.loadFile(Loader.json, '__SETTINGS', SETTINGS, function(result) {
            SongManager.initSongData(result.songs);

            // Load other song asset
            PreloadScreen.loadFile(Loader.music, '__select', result.sound_select, function(id) {
                Graphics.select = new BasicSound(id);
                Graphics.select.volume = 0.2;
            });
            PreloadScreen.loadFile(Loader.music, '__decide', result.sound_decide, function(id) {
                Graphics.decide = new BasicSound(id);
                Graphics.decide.volume = 0.2;
            });
            PreloadScreen.loadFile(Loader.music, '__complete', result.sound_complete, function(id) {
                Graphics.complete = new BasicSound(id);
                Graphics.complete.volume = 0.2;
            });

            // Background overlay
            PreloadScreen.loadFile(Loader.image, '__overlay_song', result.overlay_song, function(id) {
                Graphics.overlay_song = new Image(id, 0, 0, 1280, 720);
                Graphics.overlay_song.z(999);
            });

            // Because the number of item in this stage is dynamic,
            // donnable variable is introduced to prevent the load to be done
            // before new set of data are added.
            PreloadScreen.donnable = true;
        }, false);

        PreloadScreen.loadFile(Loader.image, '__background', BACKGROUND, function(id) {
            Graphics.backgroundImage = new Image(id, 0, 0, 1280, 720);
            Graphics.backgroundImage.z(-1000);
            Graphics.backgroundImage.fadeIn('slow');
        }, false);

        //AssetManager.queue.load();
    };

    PreloadScreen.tick = function () {
        if (PreloadScreen.currentProgress != PreloadScreen.getPercent()) {
            PreloadScreen.currentProgress = PreloadScreen.getPercent();
            PreloadScreen.progressbar.progress(PreloadScreen.currentProgress);
        }

        if (PreloadScreen.isDone() && !PreloadScreen.done) {
            PreloadScreen.loadingText.txt("Ready");
            PreloadScreen.detailText.show();
            PreloadScreen.done = true;
            Viewport.resizeAll();
        }
    };

    PreloadScreen.handleKey = function (input) {
        if (PreloadScreen.isDone() && input == ' ') {
            State.to(State.MENU);
        }
    };

    PreloadScreen.onOut = function (callback) {
        PreloadScreen.detailText.hide();
        PreloadScreen.control.hide();
        callback();
    };

    PreloadScreen.loadFile = function (loader, id, src, callback, start) {
        PreloadScreen.numberOfItem++;
        console.log("Loading", src);
        // TODO FIX THIS
         AssetManager.load(loader, id, src, function (result) { // complete callback
            PreloadScreen.completedItem++;
            PreloadScreen.currentItem = 0;
            if (callback != undefined)
                callback(result);
        }, start, function (progress) { // process callback
            PreloadScreen.currentItem = progress;
        }, function () { // error callback
            if (id.substring(0,2) == '__') { // fatal error
                PreloadScreen.loadingText.txt("Fatal error");
                PreloadScreen.detailText.txt("Please contact webmaster or try again.");
                PreloadScreen.detailText.show();
            } else {
                console.log("File not found: " + src);
                PreloadScreen.numberOfItem--;
            }
        });
    };

    PreloadScreen.getPercent = function () {
        return (PreloadScreen.completedItem+PreloadScreen.currentItem) / PreloadScreen.numberOfItem;
    };

    PreloadScreen.isDone = function () {
        // Data for each song loaded (donnable) and number of item downloaded equals to number of item to be downloaded.
        return PreloadScreen.donnable && PreloadScreen.numberOfItem == PreloadScreen.completedItem;
    };

    return PreloadScreen;
})();

var MenuScreen = (function() {
    function MenuScreen() {}

    MenuScreen.control = new LimitedControlGroup(0, 0, 1280, 720);
    MenuScreen.control.z(30);

    MenuScreen.currentSong = 0;
    MenuScreen.songDisplay = [];

    MenuScreen.movedInThisTick = false;

    MenuScreen.onIn = function () {
        if (this.songDisplay.length == 0)
            MenuScreen.makeSongDisplay();

        this.control.show();
        DynamicBackground.show();

        this.repositionSong();
    };

    MenuScreen.tick = function () {
        SongManager.tick();
        DynamicBackground.tick();

        MenuScreen.movedInThisTick = false;
    };

    MenuScreen.handleKey = function (input) {
        if (input == 'Up') {
            // Prevent lag when move too fast
            if (MenuScreen.movedInThisTick) {
                return;
            }

            MenuScreen.currentSong = MenuScreen.currentSong-1;
            if (MenuScreen.currentSong < 0)
                MenuScreen.currentSong = MenuScreen.songDisplay.length-1;

            Graphics.select.play();
            this.repositionSong();
            MenuScreen.movedInThisTick = true;
        } else if (input == 'Down') {
            // Prevent lag when move too fast
            if (MenuScreen.movedInThisTick) {
                return;
            }

            MenuScreen.currentSong = MenuScreen.currentSong+1;
            if (MenuScreen.currentSong >= MenuScreen.songDisplay.length)
                MenuScreen.currentSong = 0;

            Graphics.select.play();
            this.repositionSong();
            MenuScreen.movedInThisTick = true;
        } else if (input == 'Esc') {

        } else if (input == 'Enter' || input == ' ') {
            Graphics.decide.play();
            State.to(State.PRESONG);
        } else if (input == 'Backspace') {
            // TODO search system
        } else {

        }
    };

    MenuScreen.onOut = function (callback) {
        MenuScreen.control.hide();
        callback();
    };

    MenuScreen.makeSongDisplay = function () {
        for (var k in SongManager.songs) {
            if (!SongManager.songs.hasOwnProperty(k))
                continue;

            var c = SongManager.songs[k];
            var dat = new LimitedControlGroup(0, 0, 580, 60);
            dat.z(40);

            dat.song = c;

            var txtTitle = new Text(c.getData('title'), 30, 6, 0, "white");
            txtTitle
                .css('font-family', 'Open Sans')
                .css('text-shadow', '0px 0px 15px #999, 0px 0px 15px #fff');
            dat.add(txtTitle);

            var txtComposer = new Text(c.getData('composer'), 17, 8, 32, "white");
            txtComposer
                .css('font-family', 'Open Sans')
                .css('text-shadow', '0px 0px 15px #999, 0px 0px 15px #fff');
            dat.add(txtComposer);

            MenuScreen.songDisplay.push(dat);
            MenuScreen.control.add(dat);
        }

        MenuScreen.songDisplay.sort(MenuScreen.songSorter);
    };

    MenuScreen.repositionSong = function () {
        for (var i = 0; i < MenuScreen.songDisplay.length; i++) {
            var diff = i - MenuScreen.currentSong;
            if (Math.abs(diff) > 5) {
                MenuScreen.songDisplay[i].hide();
                continue;
            }
            var c = MenuScreen.songDisplay[i];
            c.show();
            c.setPosition(700 + (diff == 0 ? 0 : 30), 320 + 70*diff);
            if (diff != 0) {
                c.setSize(550, 0);
            } else {
                c.setSize(580, 0);
                SongManager.setSong(c.song);
            }
        }
    };

    MenuScreen.update = function () {
        MenuScreen.songDisplay.forEach(function (c) {
            c.children[0].txt(c.song.getData('title'));
            c.children[1].txt(c.song.getData('composer'));
        });
    };

    MenuScreen.songSorter = function (a, b) {
        //return a.song.getData('title-en').localeCompare(b.song.getData('title-en'));
        return a.song.getData('avg_cpm') - b.song.getData('avg_cpm');
    };

    return MenuScreen;
})();

var PresongScreen = (function() {
    function PresongScreen() {}

    PresongScreen.txtStatus = new Text("Standby", 60, 640, 355, "white", "cx,cy");
    PresongScreen.txtStatus.z(51);
    PresongScreen.txtStatus
        .css('font-family', 'Junge')
        .css('letter-spacing', '0.1em')
        .css('text-shadow', '0px 0px 20px #999, 0px 0px 20px #fff');

    PresongScreen.progressbar = new Progressbar(950, 40, 320, 5, 'rgba(255, 255, 255, 1.0)', 'rgba(0, 0, 0, 0.3)');
    PresongScreen.progressbar.bar.css('box-shadow', '0px 0px 20px 3px rgba(153, 153, 153, 0.5)');
    PresongScreen.progressbar.z(50);

    PresongScreen.progressbar2 = new Progressbar(950, 10, 320, 5, 'rgba(255, 255, 255, 1.0)', 'rgba(0, 0, 0, 0.3)');
    PresongScreen.progressbar2.bar.css('box-shadow', '0px 0px 20px 3px rgba(153, 153, 153, 0.5)');
    PresongScreen.progressbar2.z(50);

    PresongScreen.lblAudioLoad = new Text("Loading Audio", 18, 950, 15, 'white');
    PresongScreen.lblAudioLoad
        .z(60)
        .css('font-family', 'Junge')
        .css('letter-spacing', '0.1em')
        .css('text-shadow', '0px 0px 8px #999, 0px 0px 8px #fff');

    PresongScreen.lblLyricsLoad = new Text("Loading Lyrics", 18, 950, 45, 'white');
    PresongScreen.lblLyricsLoad
        .z(60)
        .css('font-family', 'Junge')
        .css('letter-spacing', '0.1em')
        .css('text-shadow', '0px 0px 8px #999, 0px 0px 8px #fff');

    PresongScreen.txtAudioLoad = new Text("0%", 18, 1270, 15, 'white', 'bx');
    PresongScreen.txtAudioLoad
        .z(60)
        .css('font-weight', 'bold')
        .css('font-family', 'Junge')
        .css('text-shadow', '0px 0px 8px #999, 0px 0px 8px #fff');

    PresongScreen.txtLyricsLoad = new Text("0%", 18, 1270, 45, 'white', 'bx');
    PresongScreen.txtLyricsLoad
        .z(60)
        .css('font-weight', 'bold')
        .css('font-family', 'Junge')
        .css('text-shadow', '0px 0px 8px #999, 0px 0px 8px #fff');

    PresongScreen.lblHelp = new Text("Esc: Return to Menu / Enter or Space: Start", 16.5, 860, 690, 'white');
    PresongScreen.lblHelp
        .z(60)
        .css('font-family', 'Junge')
        .css('letter-spacing', '0.1em')
        .css('text-shadow', '0px 0px 8px #ccc, 2px 2px 4px #333');

    PresongScreen.control = new LimitedControlGroup(0, 0, 1280, 720);
    PresongScreen.control
        .add(PresongScreen.txtStatus)
        .add(PresongScreen.progressbar)
        .add(PresongScreen.progressbar2)
        .add(PresongScreen.lblAudioLoad)
        .add(PresongScreen.lblLyricsLoad)
        .add(PresongScreen.txtAudioLoad)
        .add(PresongScreen.txtLyricsLoad)
        .add(PresongScreen.lblHelp)
        .z(50);

    PresongScreen.completed = false;
    PresongScreen.error = false;

    PresongScreen.onIn = function () {
        PresongScreen.txtStatus
            .txt("Standby")
            .css('text-shadow', '0px 0px 20px #999, 0px 0px 20px #fff');
        PresongScreen.progressbar.progress(0);

        PresongScreen.control.show();

        PresongScreen.completed = false;
        PresongScreen.error = false;

        setTimeout(function () {
            PresongScreen.okay = true;
        }, 1000);

        // Stop Autoplay if active
        // so konami code can be (re-)entered in presong stage
        AutoPlay.stop();

        SongManager.getSong().load();
    };

    PresongScreen.tick = function () {
        SongManager.tick();
        DynamicBackground.tick();
        var song = SongManager.getSong();
        if (song.isReady()) {
            if (!PresongScreen.completed) {
                PresongScreen.completed = true;
                Graphics.complete.play();

                PresongScreen.txtStatus.txt("Ready");
                PresongScreen.txtStatus.css('text-shadow', '0px 0px 20px #090, 0px 0px 20px #cfc');
                PresongScreen.progressbar.progress(1);
                PresongScreen.progressbar2.progress(1);
                PresongScreen.txtAudioLoad.txt('Complete!');
                PresongScreen.txtLyricsLoad.txt('Complete!');
            }
        } else if (song.isLyricsError || song.isAudioError) {
            if (!PresongScreen.error) {
                PresongScreen.txtStatus.txt("Error");
                PresongScreen.txtStatus.css('text-shadow', '0px 0px 20px #900, 0px 0px 20px #fcc');

                if (song.isLyricsError) {
                    PresongScreen.txtLyricsLoad.txt('Error!');
                }

                if (song.isAudioError) {
                    PresongScreen.txtAudioLoad.txt('Error!');
                }
            }
        } else {
            PresongScreen.progressbar2.progress(song.getAudioLoadProgress());
            PresongScreen.progressbar.progress(song.getLyricsLoadProgress());

            if (song.getLyricsLoadProgress() < 1)
                PresongScreen.txtLyricsLoad.txt("" + Math.round(song.getLyricsLoadProgress()*100) + "%");
            else
                PresongScreen.txtLyricsLoad.txt("Complete!");
            if (song.getAudioLoadProgress() < 1)
                PresongScreen.txtAudioLoad.txt("" + Math.round(song.getAudioLoadProgress()*100) + "%");
            else
                PresongScreen.txtAudioLoad.txt("Complete!");
        }
    };

    PresongScreen.handleKey = function (input) {
        if (SongManager.getSong().isReady() && (input == ' ' || input == 'Enter')) {
            State.to(State.SONG);
        }

        if (input == 'Esc') {
            SongManager.getSong().stop();
            State.to(State.MENU);
        }

        AutoPlay.handleInput(input);
    };

    PresongScreen.onOut = function (callback) {
        Graphics.complete.stop();
        PresongScreen.control.hide();
        callback();
    };

    return PresongScreen;
})();

var SongScreen = (function() {
    function SongScreen() {}

    SongScreen.typingText = new Text("", 32, 130, 665, "white", 'by');
    SongScreen.typingText.z(1000);
    SongScreen.typingText
        .css('font-family', 'Droid Sans')
        .css('text-shadow', '0px 0px 20px #fff, 0px 0px 20px #999');

    SongScreen.typingChar = new Text("", 90, 120, 675, "white", 'by,bx');
    SongScreen.typingChar.z(1000);
    SongScreen.typingChar
        .css('font-family', 'Droid Sans')
        .css('font-weight', 300)
        .css('text-shadow', '0px 0px 20px #fff, 0px 0px 20px #999');

    SongScreen.txtTimecode = new Text("0:00 / 0:00", 28, 1240, 425, "white", 'bx');
    SongScreen.txtTimecode.z(1000);
    SongScreen.txtTimecode
        .css('font-family', 'Open Sans')
        .css('font-weight', '600')
        .css('text-shadow', '0px 0px 8px #ccc, 2px 2px 4px #333');

    SongScreen.txtLineTyping = new Text("", 22, 185, 540, "#ddd");
    SongScreen.txtLineTyping.z(1000);
    SongScreen.txtLineTyping
        .css('font-family', 'Open Sans')
        .css('text-shadow', '0px 0px 4px #666');

    SongScreen.txtLineLyrics = new Text("", 33, 185, 608, "#ddd", 'by');
    SongScreen.txtLineLyrics.z(1000);
    SongScreen.txtLineLyrics
        .css('font-family', 'Open Sans')
        .css('text-shadow', '0px 0px 7px #666');

    SongScreen.prgOverall = new Progressbar(280, 470, 960, 5, 'white', 'gray');
    SongScreen.prgOverall.z(1000);

    SongScreen.prgInterval = new Progressbar(280, 490, 960, 5, 'white', 'gray');
    SongScreen.prgInterval.z(1000);

    SongScreen.lblTotalTime = new Text("Total Time", 15, 270, 470, 'white', 'bx,cy');
    SongScreen.lblTotalTime.z(1000);
    SongScreen.lblTotalTime
        .css('font-family', 'Junge')
        .css('letter-spacing', '0.1em')
        .css('text-shadow', '0px 0px 8px #ccc, 2px 2px 4px #333');

    SongScreen.lblInterval = new Text("Interval", 15, 270, 490, 'white', 'bx,cy');
    SongScreen.lblInterval.z(1000);
    SongScreen.lblInterval
        .css('font-family', 'Junge')
        .css('letter-spacing', '0.1em')
        .css('text-shadow', '0px 0px 8px #ccc, 2px 2px 4px #333');

    SongScreen.lblHelp= new Text("Esc: Abandon Game and View Result", 16.5, 920, 15, 'white');
    SongScreen.lblHelp.z(1000);
    SongScreen.lblHelp
        .z(1000)
        .css('font-family', 'Junge')
        .css('letter-spacing', '0.1em')
        .css('text-shadow', '0px 0px 8px #ccc, 2px 2px 4px #333');

    SongScreen.lblAutoplay = new Text("Autoplay", 36, 12, 450, "white");
    SongScreen.lblAutoplay
        .z(1000)
        .css('font-family', 'Junge')
        .css('text-shadow', '0px 0px 15px #9f9, 0px 0px 15px #cfc');

    // Scoring control
    SongScreen.lblCombo = new Text("Combo", 20, 110, 545, "white", "by");
    SongScreen.lblCombo
        .z(1000)
        .css('font-family', 'Junge')
        .css('text-shadow', '0px 0px 8px #ccc, 2px 2px 4px #333');
    SongScreen.txtCombo = new Text("", 30, 100, 545, "white", "bx,by");
    SongScreen.txtCombo
        .z(1000)
        .css('font-family', 'Junge')
        .css('letter-spacing', '0.1em')
        .css('text-shadow', '0px 0px 8px #ccc, 2px 2px 4px #333');

    SongScreen.lblScore = new Text("Score", 26, 300, 540, "white", "by");
    SongScreen.lblMaxCombo = new Text("Max Combo", 26, 580, 540, "white", "by");
    SongScreen.lblCompleted = new Text("Completed", 26, 840, 540, "white", "by");
    SongScreen.lblSolve = new Text("Solve", 26, 1080, 540, "white", "by");

    SongScreen.scoreLabel = new ControlGroup(0, 0, 1280, 720);
    SongScreen.scoreLabel
        .add(SongScreen.lblScore)
        .add(SongScreen.lblMaxCombo)
        .add(SongScreen.lblCompleted)
        .add(SongScreen.lblSolve)
        .z(1000)
        .css('font-family', 'Junge')
        .css('text-shadow', '0px 0px 8px #ccc, 2px 2px 4px #333');


    SongScreen.txtScore = new Text("", 26, 550, 541, "white", "bx,by");
    SongScreen.txtMaxCombo = new Text("", 26, 815, 541, "white", "bx,by");
    SongScreen.txtCompleted = new Text("", 26, 1060, 541, "white", "bx,by");
    SongScreen.txtSolve = new Text("", 26, 1225, 541, "white", "bx,by");

    SongScreen.scoreText = new ControlGroup(0, 0, 1280, 720);
    SongScreen.scoreText
        .add(SongScreen.txtScore)
        .add(SongScreen.txtMaxCombo)
        .add(SongScreen.txtCompleted)
        .add(SongScreen.txtSolve)
        .z(1000)
        .css('font-family', 'Open Sans')
        .css('font-weight', '600')
        .css('text-shadow', '0px 0px 8px #ccc, 2px 2px 4px #333');

    SongScreen.lblSpeed   = new Text("Type Speed", 15, 195, 710, "white", "by");
    SongScreen.lblSpeed2  = new Text("/ min", 15, 375, 710, "white", "by");
    SongScreen.lblCorrect = new Text("Correct", 15, 450, 710, "white", "by");
    SongScreen.lblMissed  = new Text("Missed", 15, 655, 710, "white", "by");
    SongScreen.lblPercent = new Text("Correct Percent", 15, 860, 710, "white", "by");
    SongScreen.lblClass   = new Text("Class", 15, 1140, 710, "white", "by");

    SongScreen.scoreLabel2 = new ControlGroup(0, 0, 1280, 720);
    SongScreen.scoreLabel2
        .add(SongScreen.lblSpeed)
        .add(SongScreen.lblSpeed2)
        .add(SongScreen.lblCorrect)
        .add(SongScreen.lblMissed)
        .add(SongScreen.lblPercent)
        .add(SongScreen.lblClass)
        .z(1000)
        .css('font-family', 'Junge')
        .css('text-shadow', '0px 0px 8px #ccc, 2px 2px 4px #333');

    SongScreen.txtSpeed   = new Text("", 28, 360, 715, "white",  "by,bx");
    SongScreen.txtCorrect = new Text("", 28, 602.5, 715, "white",  "by,bx");
    SongScreen.txtMissed  = new Text("", 28, 800, 715, "white",  "by,bx");
    SongScreen.txtPercent = new Text("", 28, 1060, 715, "white",  "by,bx");
    SongScreen.txtClass   = new Text("", 28, 1200, 715, "white", "by");

    SongScreen.scoreText2 = new ControlGroup(0, 0, 1280, 720);
    SongScreen.scoreText2
        .add(SongScreen.txtSpeed  )
        .add(SongScreen.txtCorrect)
        .add(SongScreen.txtMissed )
        .add(SongScreen.txtPercent)
        .add(SongScreen.txtClass  )
        .z(1000)
        .css('font-family', 'Open Sans')
        .css('font-weight', '600')
        .css('text-shadow', '0px 0px 8px #ccc, 2px 2px 4px #333');

    SongScreen.control = new LimitedControlGroup(0, 0, 1280, 720);
    SongScreen.control
        .add(SongScreen.typingText)
        .add(SongScreen.typingChar)
        .add(SongScreen.txtTimecode)
        .add(SongScreen.txtLineTyping)
        .add(SongScreen.txtLineLyrics)
        .add(SongScreen.prgOverall)
        .add(SongScreen.prgInterval)
        .add(SongScreen.lblInterval)
        .add(SongScreen.lblTotalTime)
        .add(SongScreen.lblHelp)
        .add(SongScreen.scoreLabel)
        .add(SongScreen.scoreText)
        .add(SongScreen.scoreLabel2)
        .add(SongScreen.scoreText2)
        .z(1000);

    SongScreen.shouldUpdate = false;
    SongScreen.lastVerse = -1;

    SongScreen.onIn = function () {
        SongScreen.shouldUpdate = true;
        SongScreen.lastVerse = -1;
        SongScreen.scoringLine = false;

        ScoreEngine.songStart();
        SongScreen.control.show();

        // Reset elements
        SongScreen.typingText.$.empty();
        SongScreen.typingChar.txt("");
        SongScreen.txtTimecode.txt("0:00 / 0:00");
        SongScreen.txtLineTyping.$.empty();
        SongScreen.txtLineLyrics.txt("");
        SongScreen.prgOverall.progress(0);
        SongScreen.prgInterval.progress(0);

        SongScreen.txtScore.txt("");
        SongScreen.txtMaxCombo.txt("");
        SongScreen.txtCompleted.txt("");
        SongScreen.txtSolve.txt("");

        SongScreen.txtSpeed.txt("");
        SongScreen.txtCorrect.txt("");
        SongScreen.txtMissed.txt("");
        SongScreen.txtPercent.txt("");
        SongScreen.txtClass.txt("");

        Graphics.overlay_song.show();
        SongManager.getSong().play();
    };

    SongScreen.tick = function () {
        SongManager.tick();
        AutoPlay.tick();
        DynamicBackground.tick();

        var song = SongManager.getSong();

        if (song == null)
            return;

        // Show Autoplay Label if activated
        if (AutoPlay.active && !SongScreen.lblAutoplay.visible())
            SongScreen.lblAutoplay.show();

        // Process typing display & auxiliary line
        if (SongScreen.shouldUpdate || SongScreen.lastVerse != song.currentVerse) {
            SongScreen.typingText.$.empty();
            var tl = song.getTypingList();
            var tchar = "";
            tl.forEach(function (c) {
                var cc = $('<span></span>');
                cc.css('padding-right', '0.4em');
                if (tchar.length == 0) {
                    tchar = c.substring(0, 1);
                    if (c.length > 1)
                        cc.text(c.substring(1));
                } else {
                    cc.text(c);
                }
                SongScreen.typingText.$.append(cc);
            });
            SongScreen.typingText.shouldResize();
            SongScreen.typingChar.txt(tchar);

            // Scoring extract
            if (tchar.length == 0) {
                ScoreEngine.onLineEnd(0);
            }

            var line;
            if ((song.typing != null && song.typing.isComplete()) || song.isBlank(song.currentVerse)) {
                line = song.getNextVerse();
                SongScreen.combinedTypingSimple(line.typing, SongScreen.txtLineTyping.$)
            } else {
                line = song.getCurrentVerse();
                SongScreen.combinedTypingCurrent(song.typing, SongScreen.txtLineTyping.$)
            }

            SongScreen.txtLineLyrics.html(line.lyrics);
            SongScreen.txtLineTyping.shouldResize();
            SongScreen.currentShowingLine = line;

            // Scoring
            if (SongScreen.lastVerse != song.currentVerse) {
                if (SongScreen.scoringLine)
                    ScoreEngine.onLineEnd(song.typingLeftChar);

                SongScreen.scoringLine = !song.isBlank(song.currentVerse);

                if (SongScreen.scoringLine)
                    ScoreEngine.onLineStart();
            }

            // Update scoring
            if (ScoreEngine.currentCombo != 0) {
                SongScreen.txtCombo.show();
                SongScreen.lblCombo.show();
                SongScreen.txtCombo.txt($comma(ScoreEngine.currentCombo));
            } else {
                SongScreen.txtCombo.hide();
                SongScreen.lblCombo.hide();
            }
            SongScreen.txtScore.txt($comma(Math.round(ScoreEngine.score)));
            SongScreen.txtMaxCombo.txt($comma($formatNumber(ScoreEngine.maxCombo, 3)));
            SongScreen.txtCompleted.txt($comma($formatNumber(ScoreEngine.completed, 3)));
            SongScreen.txtSolve.txt($comma($formatNumber(ScoreEngine.solve, 3)));

            SongScreen.txtCorrect.txt($comma($formatNumber(ScoreEngine.typed, 3)));
            SongScreen.txtMissed.txt($comma($formatNumber(ScoreEngine.missed, 3)));
            SongScreen.txtPercent.txt("" + Math.round(ScoreEngine.getPercent()*100) + "%");
            SongScreen.txtClass.txt(ScoreEngine.getClass());

            // Update
            SongScreen.lastVerse = song.currentVerse;
            SongScreen.shouldUpdate = false;

        }

        // Update CPM
        SongScreen.txtSpeed.txt($comma($formatNumber(Math.round(ScoreEngine.getCPM()), 3)));

        // Other stats
        SongScreen.txtTimecode.txt(SongManager.formatTime(song.getTime()) + " / " + SongManager.formatTime(song.getDuration()));
        SongScreen.prgOverall.progress(song.getProgress());

        // Interval progressbar
        var tun = song.getTimeUntilNextLine();
        var tcl = song.getCurrentSectionTime();
        SongScreen.prgInterval.progress((tcl-tun)/tcl);
        if (song.isComplete()) {
            State.to(State.SCORE);
        }

    };

    SongScreen.combinedTypingSimple = function (t, elem) {
        elem.empty();
        t.forEach(function (c) {
            var cc = $('<span></span>');
            cc.css('padding-right', '0.35em');
            cc.text(c);
            elem.append(cc);
        });
    };

    /* This is complicated because it allow highligh
       as we typing in auxiliary line
     */
    SongScreen.combinedTypingCurrent = function (t, elem) {
        elem.empty();
        var completed = false;
        t.typingWords.forEach(function (c) {
            var cc = $('<span></span>');
            cc.css('padding-right', '0.35em');
            if (c.isComplete()) {
                cc.css('color', '#00fefe');
                var text = "";
                c.typingItem.forEach(function (i) {
                    text += i.character;
                });
                cc.text(text);
            } else if (!completed) {
                c.typingItem.forEach(function (i) {
                    var ci = $('<span></span>');
                    ci.text(i.character);
                    if (i.isComplete()) {
                        ci.css('color', '#00fefe');
                        completed = true;
                    } else if (i.input.length > 0) {
                        ci.css('color', '#fefe00');
                    }
                    cc.append(ci);
                });
            } else {
                var text = "";
                c.typingItem.forEach(function (i) {
                    text += i.character;
                });
                cc.text(text);
            }
            elem.append(cc);
        });
    };

    SongScreen.handleKey = function (input) {
        if (input == 'Esc') {
            State.to(State.SCORE);
            return;
        }

        if (AutoPlay.handleInput(input)) {
            return;
        }

        SongScreen.shouldUpdate = true;
        var result = SongManager.getSong().handleKey(input);
        if (result !== false) {
            ScoreEngine.onType(result);
        }
    };

    SongScreen.onOut = function (callback) {
        // These items are not in main controlgroup
        SongScreen.txtCombo.hide();
        SongScreen.lblCombo.hide();
        SongScreen.lblAutoplay.hide();

        ScoreEngine.songEnd();
        SongScreen.control.hide();
        Graphics.overlay_song.hide();
        DynamicBackground.update();
        callback();
    };

    return SongScreen;
})();

var ScoreScreen = (function() {
    function ScoreScreen() {}

    ScoreScreen.lblHelp = new Text("Enter or Space: Return to Menu", 16.5, 950, 15, 'white');
    ScoreScreen.lblHelp.z(1000);
    ScoreScreen.lblHelp
        .z(75)
        .css('font-family', 'Junge')
        .css('letter-spacing', '0.1em')
        .css('text-shadow', '0px 0px 8px #ccc, 2px 2px 4px #333');

    ScoreScreen.lblCombo    = new Text("Combo"                       , 18, 100, 480, 'white', 'by');
    ScoreScreen.lblCorrect  = new Text("Correct"                     , 18, 100, 530, 'white', 'by');
    ScoreScreen.lblMissed   = new Text("Missed"                      , 18, 100, 560, 'white', 'by');
    ScoreScreen.lblComplete = new Text("Completed"                   , 18, 100, 610, 'white', 'by');
    ScoreScreen.lblSolve    = new Text("Solve"                       , 18, 100, 640, 'white', 'by');
    ScoreScreen.lblSpeed    = new Text("Type speed / min"            , 18, 355, 480, 'white', 'by');
    ScoreScreen.lblPercent1 = new Text("Correct percent"             , 18, 355, 530, 'white', 'by');
    ScoreScreen.lblPercene2 = new Text("Correct percent (solve cut)" , 18, 355, 560, 'white', 'by');

    ScoreScreen.lblLeftGroup = new ControlGroup(0, 0, 1280, 720);
    ScoreScreen.lblLeftGroup
        .add(ScoreScreen.lblCombo   )
        .add(ScoreScreen.lblCorrect )
        .add(ScoreScreen.lblMissed  )
        .add(ScoreScreen.lblComplete)
        .add(ScoreScreen.lblSolve   )
        .add(ScoreScreen.lblSpeed   )
        .add(ScoreScreen.lblPercent1)
        .add(ScoreScreen.lblPercene2)
        .css('font-family', 'Junge')
        .css('text-shadow', '0px 0px 8px #ccc, 2px 2px 4px #333');

    ScoreScreen.txtCombo    = new Text("", 28, 310, 487, 'white', 'by,bx');
    ScoreScreen.txtCorrect  = new Text("", 28, 310, 537, 'white', 'by,bx');
    ScoreScreen.txtMissed   = new Text("", 28, 310, 567, 'white', 'by,bx');
    ScoreScreen.txtComplete = new Text("", 28, 310, 617, 'white', 'by,bx');
    ScoreScreen.txtSolve    = new Text("", 28, 310, 647, 'white', 'by,bx');
    ScoreScreen.txtSpeed    = new Text("", 28, 590, 487, 'white', 'by,bx');
    ScoreScreen.txtPercent1 = new Text("", 28, 680, 537, 'white', 'by,bx');
    ScoreScreen.txtPercent2 = new Text("", 28, 680, 567, 'white', 'by,bx');

    ScoreScreen.txtScore = new Text(""     , 48, 210, 370, 'white');
    ScoreScreen.lblScore = new Text("Score", 40, 185, 375, 'white', 'bx');
    ScoreScreen.txtClass = new Text(""     , 72, 210, 290, 'white');
    ScoreScreen.lblClass = new Text("Class", 60, 185, 300, 'white', 'bx');

    ScoreScreen.txtLeftGroup = new ControlGroup(0, 0, 1280, 720);
    ScoreScreen.txtLeftGroup
        .add(ScoreScreen.txtCombo   )
        .add(ScoreScreen.txtCorrect )
        .add(ScoreScreen.txtMissed  )
        .add(ScoreScreen.txtComplete)
        .add(ScoreScreen.txtSolve   )
        .add(ScoreScreen.txtSpeed   )
        .add(ScoreScreen.txtPercent1)
        .add(ScoreScreen.txtPercent2)
        .css('font-family', 'Open Sans')
        .css('font-weight', '600')
        .css('text-shadow', '0px 0px 8px #ccc, 2px 2px 4px #333');

    ScoreScreen.classGroup = new ControlGroup(0, 0, 1280, 720);
    ScoreScreen.classGroup
        .add(ScoreScreen.lblClass)
        .add(ScoreScreen.txtClass)
        .css('font-family', 'Junge')
        .css('text-shadow', '0px 0px 20px #00fefe, 0px 0px 20px #00fefe');

    ScoreScreen.scoreGroup = new ControlGroup(0, 0, 1280, 720);
    ScoreScreen.scoreGroup
        .add(ScoreScreen.lblScore)
        .add(ScoreScreen.txtScore)
        .css('font-family', 'Junge')
        .css('text-shadow', '0px 0px 20px #fefe00, 0px 0px 20px #fefe00');

    // Summary box
    ScoreScreen.scoreCard = new LimitedControlGroup(820, 250, 400, 420);
    ScoreScreen.scoreCard.block.position.fs = 20; // a little bit of css hack to make -em works
    ScoreScreen.scoreCard.block
        .css('background-color', 'rgba(255, 255, 255, 0.7)')
        .css('border-radius', '1em');

    ScoreScreen.cardTitle = new Text("Score card", 30, 200, 10, "black", "cx");
    ScoreScreen.cardTitle
        .css('font-family', 'Droid Serif')
        .css('font-weight', '700')
        .css('text-shadow', '0px 0px 12px #fff, 0px 0px 12px #fff');

    ScoreScreen.cardLabel = new Text("", 16, 150, 50, "#555", 'bx');
    ScoreScreen.cardLabel
        .css('text-align', 'right')
        .css('font-family', 'Droid Sans');

    ScoreScreen.cardText = new Text("", 16, 160, 50, "black");
    ScoreScreen.cardText
        .css('font-family', 'Droid Sans');

    ScoreScreen.scoreCard
        .add(ScoreScreen.cardTitle)
        .add(ScoreScreen.cardLabel)
        .add(ScoreScreen.cardText);

    ScoreScreen.control = new LimitedControlGroup(0, 0, 1280, 720);
    ScoreScreen.control
        .add(ScoreScreen.lblHelp)
        .add(ScoreScreen.lblLeftGroup)
        .add(ScoreScreen.txtLeftGroup)
        .add(ScoreScreen.classGroup)
        .add(ScoreScreen.scoreGroup)
        .add(ScoreScreen.scoreCard)
        .z(75);

    ScoreScreen.onIn = function () {
        var $format = function (s) {
            return $comma(s);
        };

        // Set score text
        ScoreScreen.txtCombo.txt($format(ScoreEngine.maxCombo));
        ScoreScreen.txtCorrect.txt($format(ScoreEngine.typed));
        ScoreScreen.txtMissed.txt($format(ScoreEngine.missed));
        ScoreScreen.txtComplete.txt($format(ScoreEngine.completed));
        ScoreScreen.txtSolve.txt($format(ScoreEngine.solve));
        ScoreScreen.txtSpeed.txt(Math.round(ScoreEngine.getCPM()));
        ScoreScreen.txtPercent1.txt("" + Math.round(ScoreEngine.getPercent()*100) + "%");
        ScoreScreen.txtPercent2.txt("" + Math.round(ScoreEngine.getPercent2()*100) + "%");

        ScoreScreen.txtScore.txt($format(Math.round(ScoreEngine.score)));
        ScoreScreen.txtClass.txt(ScoreEngine.getClass());

        // Score card
        ScoreScreen.cardLabel.html('' +
            '<p style="margin:0;margin-bottom:0.6em">Song name (JP)                </p>' +
            '<p style="margin:0;margin-bottom:0.6em">Song name (EN)                </p>' +
            '<p style="margin:0;margin-bottom:0.6em">Class                         </p>' +
            '<p style="margin:0;margin-bottom:0.6em">Score                         </p>' +
            '<p style="margin:0;margin-bottom:0.6em">Max Combo                     </p>' +
            '<p style="margin:0;margin-bottom:0.6em">Correct                       </p>' +
            '<p style="margin:0;margin-bottom:0.6em">Missed                        </p>' +
            '<p style="margin:0;margin-bottom:0.6em">Completed                     </p>' +
            '<p style="margin:0;margin-bottom:0.6em">Solve                         </p>' +
            '<p style="margin:0;margin-bottom:0.6em">Speed                         </p>' +
            '<p style="margin:0;margin-bottom:0.6em">Correct Percent               </p>' +
            '<p style="margin:0;margin-bottom:0.6em">Correct Percent<br>(solve cut)</p>');
        ScoreScreen.cardText.html('' +
            '<p style="margin:0;margin-bottom:0.6em">' + SongManager.getSong().getData('title-jp') + '</p>' +
            '<p style="margin:0;margin-bottom:0.6em">' + SongManager.getSong().getData('title-en') + '</p>' +
            '<p style="margin:0;margin-bottom:0.6em">' + ScoreEngine.getClass() + '</p>' +
            '<p style="margin:0;margin-bottom:0.6em">' + $format(Math.round(ScoreEngine.score)) + '</p>' +
            '<p style="margin:0;margin-bottom:0.6em">' + $format(ScoreEngine.maxCombo) + '</p>' +
            '<p style="margin:0;margin-bottom:0.6em">' + $format(ScoreEngine.typed) + '</p>' +
            '<p style="margin:0;margin-bottom:0.6em">' + $format(ScoreEngine.missed) + '</p>' +
            '<p style="margin:0;margin-bottom:0.6em">' + $format(ScoreEngine.completed) + '</p>' +
            '<p style="margin:0;margin-bottom:0.6em">' + $format(ScoreEngine.solve) + '</p>' +
            '<p style="margin:0;margin-bottom:0.6em">' + $format(Math.round(ScoreEngine.getCPM())) + ' cpm</p>' +
            '<p style="margin:0;margin-bottom:0.6em">' + Math.round(ScoreEngine.getPercent()*100) + '%</p>' +
            '<p style="margin:0;margin-bottom:0.6em">' + Math.round(ScoreEngine.getPercent2()*100) + '%</p>')
            .css('width', '3000px');

        // Show Control
        ScoreScreen.control.show();
    };

    ScoreScreen.tick = function () {};

    ScoreScreen.handleKey = function (input) {
        if (input == ' ' || input == 'Esc' || input == 'Enter')
            State.to(State.MENU);
    };

    ScoreScreen.onOut = function (callback) {
        SongManager.getSong().stop();
        ScoreScreen.control.hide();
        callback();
    };

    return ScoreScreen;
})();

var DynamicBackground = (function () {
    function DynamicBackground () {}
    DynamicBackground.imgTransitioning = false;
    DynamicBackground.currentImage = null;

    DynamicBackground.showSongInfo = false;
    DynamicBackground.currentSongInfo = '';
    DynamicBackground.control = new LimitedControlGroup(0, 0, 1280, 720);

    DynamicBackground.txtSubitle = new Text("", 16, 25, 90, "white");
    DynamicBackground.txtComposer = new Text("", 21, 25, 110, "white");
    DynamicBackground.txtTitle = new Text("", 40, 25, 140, "white");

    DynamicBackground.titleGroup = new ControlGroup(0, 0, 1280, 720);
    DynamicBackground.titleGroup
        .add(DynamicBackground.txtTitle)
        .add(DynamicBackground.txtSubitle)
        .add(DynamicBackground.txtComposer)
        .z(15)
        .css('font-family', '"Open Sans", sans-serif')
        .css('font-weight', '600')
        .css('text-shadow', '0px 0px 20px #999, 0px 0px 20px #fff');

    DynamicBackground.lblLastUpdate = new Text("Last updated: ", 20, 180, 220, "white", "bx");
    DynamicBackground.lblHighscore  = new Text("High score: ", 20, 180, 250, "white", "bx");
    DynamicBackground.lblClass      = new Text("Class: ", 20, 350, 250, "white");

    DynamicBackground.txtLastUpdate = new Text("-", 20, 200, 220, "white");
    DynamicBackground.txtHighscore  = new Text("-", 20, 200, 250, "white");
    DynamicBackground.txtClass      = new Text("-", 20, 450, 250, "white", "bx");

    DynamicBackground.highscoreGroup = new ControlGroup(0, 0, 1280, 720);
    DynamicBackground.highscoreGroup
        .add(DynamicBackground.lblLastUpdate)
        .add(DynamicBackground.lblHighscore )
        .add(DynamicBackground.lblClass     )
        .add(DynamicBackground.txtLastUpdate)
        .add(DynamicBackground.txtHighscore )
        .add(DynamicBackground.txtClass     )
        .z(15)
        .css('font-family', 'Junge')
        .css('letter-spacing', '0.1em')
        .css('text-shadow', '0px 0px 8px #ccc, 2px 2px 4px #333');

    DynamicBackground.lblVolume = new Text("Master Volume", 15, 10, 7, "white");
    DynamicBackground.lblVolume
        .z(15)
        .css('font-family', 'Junge')
        .css('letter-spacing', '0.1em')
        .css('text-shadow', '0px 0px 8px #ccc, 2px 2px 4px #333');

    DynamicBackground.prgVolume = new Progressbar(150, 15, 250, 5, "white", "gray");
    DynamicBackground.prgVolume.z(1000);

    DynamicBackground.currentVolume = $.jStorage.get('__typingmania_volume', 1.0);

    DynamicBackground.control
        .add(DynamicBackground.titleGroup)
        .add(DynamicBackground.highscoreGroup)
        .add(DynamicBackground.lblVolume)
        .add(DynamicBackground.prgVolume);

    DynamicBackground.show = function () {
        DynamicBackground.updateVolumeControl();
        DynamicBackground.control.show();
    };

    DynamicBackground.hide = function () {
        DynamicBackground.control.hide();
    };

    DynamicBackground.tick = function () {
        if (SongManager.song != null) {
            // Background Image
            var song = SongManager.song;

            if (song.image == null) {
                song.loadImage();
            }

            if (!DynamicBackground.imgTransitioning && song.image != null && !song.image.visible()) {
                song.image.z(10);
                if (DynamicBackground.currentImage != null) {
                    DynamicBackground.currentImage.z(11);
                    DynamicBackground.currentImage.fadeOut('slow', function() {
                        DynamicBackground.imgTransitioning = false;
                    });
                    song.image.show();
                    DynamicBackground.currentImage = song.image;
                } else {
                    song.image.fadeIn('slow', function() {
                        DynamicBackground.imgTransitioning = false;
                    });
                    DynamicBackground.currentImage = song.image;
                }

                DynamicBackground.imgTransitioning = true;
            }

            // Song Info
            if (DynamicBackground.currentSongInfo != song.id) {
                DynamicBackground.currentSongInfo = song.id;
                DynamicBackground.update();
            }
        }
    };

    DynamicBackground.update = function () {
        var song = SongManager.song;
        DynamicBackground.txtTitle.txt(song.getData('title'));
        DynamicBackground.txtSubitle.txt(song.getData('subtitle'));
        DynamicBackground.txtComposer.txt(song.getData('composer'));
        var data = ScoreEngine.getHighScore();
        if (data == null) {
            DynamicBackground.txtLastUpdate.txt('-');
            DynamicBackground.txtHighscore.txt('-');
            DynamicBackground.txtClass.txt('-');
        } else {
            DynamicBackground.txtLastUpdate.txt(new Date(data.update).toLocaleString());
            DynamicBackground.txtHighscore.txt($comma(Math.round(data.score)));
            DynamicBackground.txtClass.txt(data.class);
        }
    };

    // for master volume
    DynamicBackground.handleKey = function (input) {
        if (input == 'PgUp') {
            DynamicBackground.currentVolume = Math.min(DynamicBackground.currentVolume + 0.025, 2.0);
            DynamicBackground.updateVolumeControl();
            return true;
        } else if (input == 'PgDown') {
            DynamicBackground.currentVolume = Math.max(DynamicBackground.currentVolume - 0.025, 0.0);
            DynamicBackground.updateVolumeControl();
            return true;
        } else
            return false;
    };

    DynamicBackground.updateVolumeControl = function () {
        //createjs.Sound.setVolume(DynamicBackground.currentVolume);
        DynamicBackground.prgVolume.progress(DynamicBackground.currentVolume / 2);
        $.jStorage.set('__typingmania_volume', DynamicBackground.currentVolume);
    };

    // TODO mouse for volume changing

    return DynamicBackground;
})();

/// ///////////////////////
/// Startup

return function() {

    // Graphics Initialization
    Graphics.init();
    Viewport.onResize();

    // Window event
    $(window).on("resize", Viewport.onResize);
    $(window).on("keydown", function (event) {
        var code = event.which;
        var input = KeyCode.fromKeyCode(code, event.shiftKey);

        if (input == '')
            return;

        if (input == 'Tab') {
            // Change language
            if (Graphics.language == 'en')
                Graphics.language = 'jp';
            else
                Graphics.language = 'en';

            DynamicBackground.update();
            MenuScreen.update();
        } else if (DynamicBackground.handleKey(input)) {
        } else switch (State.current) {
            case State.PRELOAD:
                PreloadScreen.handleKey(input);
                break;
            case State.MENU:
                MenuScreen.handleKey(input);
                break;
            case State.PRESONG:
                PresongScreen.handleKey(input);
                break;
            case State.SONG:
                SongScreen.handleKey(input);
                break;
            case State.SCORE:
                ScoreScreen.handleKey(input);
                break;
        }

        if (input != '')
            event.preventDefault();
    });

    // Page Visibility API
    // Note: only browser that support this natively is Firefox I think. Sucks.
    var visibilityChangeFunc = function () {
        if (document.hidden || document.msHidden || document.webkitHidden || document.mozHidden) {
            if (SongManager.getSong() != null && SongManager.getSong().isPlaying) {
                SongManager.getSong().audio.pause();
                console.log("Song paused.");
            }
        } else {
            if (SongManager.getSong() != null && SongManager.getSong().isPlaying) {
                SongManager.getSong().audio.resume();
                console.log("Song resumed.");
            }
        }
    };
    $(document).on("visibilityChange", visibilityChangeFunc);
    $(document).on("msvisibilitychange", visibilityChangeFunc);
    $(document).on("webkitvisibilitychange", visibilityChangeFunc);
    $(document).on("mozvisibilitychange", visibilityChangeFunc);

    // Main game loop
    var requestAnimFrame = (function(){
        return  window.requestAnimationFrame       ||
                window.webkitRequestAnimationFrame ||
                window.mozRequestAnimationFrame    ||
                function(callback){
                    window.setTimeout(callback, 1000 / 60);
                };
    })();

    var renderLoop = function() {
        requestAnimFrame(renderLoop);

        switch (State.current) {
            case State.PRELOAD:
                PreloadScreen.tick();
                break;
            case State.MENU:
                MenuScreen.tick();
                break;
            case State.PRESONG:
                PresongScreen.tick();
                break;
            case State.SONG:
                SongScreen.tick();
                break;
            case State.SCORE:
                ScoreScreen.tick();
                break;
        }

        // Set title bar
        if (SongManager.getSong() != null) {
            var title = '';
            title += SongManager.getSong().getData('title');
            title += ' - TypingMania'; // TODO make this show what's show in config file
        } else {
            title = 'TypingMania';
        }
        document.title = title;
    };

    renderLoop();

    // Start game
    PreloadScreen.onIn();

};
});

