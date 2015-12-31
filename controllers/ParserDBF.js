// Generated by CoffeeScript 1.8.0
(function () {
    var DBFParser, EventEmitter, JSZip, fs, iconv,
        __bind = function (fn, me) {
            return function () {
                return fn.apply(me, arguments);
            };
        },
        __hasProp = {}.hasOwnProperty,
        __extends = function (child, parent) {
            for (var key in parent) {
                if (__hasProp.call(parent, key)) child[key] = parent[key];
            }
            function ctor() {
                this.constructor = child;
            }

            ctor.prototype = parent.prototype;
            child.prototype = new ctor();
            child.__super__ = parent.prototype;
            return child;
        };

    EventEmitter = require('events').EventEmitter;

    fs = require('fs');
    iconv = require('iconv-lite');
    JSZip = require("jszip");
    liner = require("liner");
    //sleep = require('sleep');
    cluster = require('cluster');
    numCPUs = require('os').cpus().length;

    var i_i = 0;
    var lim_buf = 0;
    var residueBuffer;
    var readableStream;
    var event = 'start';

    DBFParser = (function (_super) {
        __extends(DBFParser, _super);

        function DBFParser(fileName, encoding, rowsNumder, dbAmount) {
            this.fileName = fileName;
            this.amount = 0;
            this.dbAmount = (dbAmount === undefined) ? 0 : dbAmount;
            this.rowsNumder = rowsNumder;
            this.encoding = encoding != null ? encoding : 'GBK';
            this._parseField = __bind(this._parseField, this);
            this._parseRecords = __bind(this._parseRecords, this);
            this._parseHead = __bind(this._parseHead, this);
            this.timeReg1 = /^(?:(?!0000)[0-9]{4}-(?:(?:0[1-9]|1[0-2])-(?:0[1-9]|1[0-9]|2[0-8])|(?:0[13-9]|1[0-2])-(?:29|30)|(?:0[13578]|1[02])-31)|(?:[0-9]{2}(?:0[48]|[2468][048]|[13579][26])|(?:0[48]|[2468][048]|[13579][26])00)-02-29)\s+([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/;
        }

        DBFParser.prototype.parse = function () {
            console.log('PARSER START');

            readableStream = fs.createReadStream(this.fileName);
            readableStream
                .on('open', (function (_this) {
                    return function () {
                        console.log("START READ STREAM", "EVENT: " + event);
                        _this.emit('start');
                        event = 'start';
                        this.amount = 0;
                    }
                })(this))
                .on('data', (function (_this) {
                    return function (buffer) {
                        i_i++;
                        //console.log(i_i);
                        if ((i_i === 1) && (event == 'start')) {
                            //console.log('Read .on data id: ' + i_i);
                            //console.log(buffer);
                            //console.log('Buffer length:' + buffer.length);
                            _this._parseHead(buffer);
                            _this._parseRecords(buffer);
                        }
                        else if (event == 'start') {
                            _this._parseRecords(buffer);
                            readableStream.pause();
                            if (!isNaN(parseInt(_this.dbAmount, 10)) && !isNaN(parseInt(_this.amount, 10))) {
                                var interval = setInterval(function () {
                                    if ((_this.dbAmount === 0) || (_this.dbAmount === undefined)) {
                                        //Число больше т.к. значения отсутствуют
                                        console.log("Читаем дальше т.к. значения отсутствуют...", _this.amount, _this.dbAmount);
                                        readableStream.resume();
                                        clearInterval(interval);
                                    } else if (_this.dbAmount >= _this.amount) {
                                        //Читаем дальше...
                                        console.log("Читаем дальше...", _this.amount, _this.dbAmount);
                                        readableStream.resume();
                                        clearInterval(interval);
                                    } else if (_this.dbAmount >= (_this.amount - 622)) {
                                        //Пусть будет небольшая забивка буфера числом на 622 записи
                                        console.log("Читаем дальше... c забивкой буфера", _this.amount, _this.dbAmount);
                                        readableStream.resume();
                                        clearInterval(interval);
                                    } else {
                                        //Ждем
                                        console.log("Ждем...", _this.amount, _this.dbAmount);
                                    }
                                }, 100);
                            } else {
                                setTimeout(function () {
                                    readableStream.resume();
                                }, 25000);
                            }
                        } else {
                            i_i = 0;
                        }
                    }
                })(this))
                .on('error', function (error) {
                    i_i = 0;
                    throw error;
                })
                .on('end', (function (_this) {
                    return function () {
                        console.log("Finish record stream .on end");
                        _this.emit('end');
                        readableStream.destroy();
                        readableStream.close();
                        i_i = 0;
                    }
                })(this));

            this.on('end', (function (_this) {
                return function () {
                    console.log('Emit end enable this.on end');
                    readableStream.destroy();
                    readableStream.close();
                    _this.amount = 0;
                    lim_buf = 0;
                    event = 'end';
                    i_i = 0;
                }
            })(this));
        };

        DBFParser.prototype.parseZip = function () {
        };

        DBFParser.prototype._parseHead = function (buffer) {
            var dd, field, head, i, k;
            head = {};
            head.version = this.version = buffer[0].toString();
            head.updatedDate = this.updatedDate = new Date(1900 + buffer[1], buffer[2] - 1, dd = buffer[3]);
            head.recordsCount = this.recordsCount = buffer.readUInt32LE(4, true);
            head.headOffset = this.headOffset = buffer.readUInt16LE(8, true);
            head.recordLength = this.recordLength = buffer.readUInt16LE(10, true);
            head.fields = [];
            k = 0;
            this.fields = (function () {
                var _i, _ref, _results;
                _results = [];
                for (i = _i = 32, _ref = this.headOffset - 32; _i <= _ref; i = _i += 32) {
                    field = {
                        name: (iconv.decode(buffer.slice(i, i + 11), this.encoding).replace(/[\u0000].*$/, '')).replace(/^[\r]+|[\n]+|[\r\n]+|[\n\r]+/, ''),
                        type: (String.fromCharCode(buffer[i + 11])).replace(/[\u0000]+$/, ''),
                        address: buffer.readUInt32LE(i + 12, true),
                        length: buffer.readUInt8(i + 16),
                        precision: buffer.readUInt8(i + 17)
                    };
                    if (field.name !== '') {
                        head.fields[k++] = field;
                    }
                    _results.push(field);
                }
                return _results;
            }).call(this);
            return this.emit('head', head);
        };

        DBFParser.prototype._parseRecords = function (buffer) {
            var residueBufferSuccess, bufferTemp, curPoint, endPoint, field, i, point, record, _i, _ref, _ref1, _results;
            endPoint = this.headOffset + this.recordLength * this.recordsCount - 1;

            if (residueBuffer) residueBufferSuccess = true;

            bufferTemp = null;
            _results = [];

            if ((i_i === 1) && (this.amount === 0)) head_coif = this.headOffset;
            else if (residueBuffer) head_coif = 0 - residueBuffer.length;
            else head_coif = 0;

            for (point = _i = _ref = head_coif, _ref1 = this.recordLength;
                 _ref1 > 0 ? _i <= endPoint : _i >= endPoint;
                 point = _i += _ref1
            ) {

                if ((buffer.length - point) < this.recordLength) {
                    continue;
                }

                if ((buffer.length - (point + this.recordLength)) < this.recordLength) {
                    residueBuffer = buffer.slice((point + this.recordLength), buffer.length);
                    //console.log('Данные из residueBuffer записанны успешно: ' + residueBuffer.length);
                }

                if ((residueBufferSuccess === true) && (this.amount === 0)){
                    console.log('Произошел сброс переменной residueBufferSuccess');
                    residueBufferSuccess = false;
                }

                if (residueBufferSuccess === true) {
                    //console.log('Произошло склеивание строк');
                    residueBuffer = iconv.decode(residueBuffer, this.encoding);
                    bufferTemp = buffer.slice(0, (this.recordLength - residueBuffer.length));
                    bufferTemp = iconv.decode(bufferTemp, this.encoding);
                    //console.log(bufferTemp);
                    bufferTemp = residueBuffer + bufferTemp;
                    //console.log(bufferTemp);
                    bufferTemp = iconv.encode(bufferTemp, this.encoding);
                    //console.log(bufferTemp);
                    residueBuffer = false;
                    residueBufferSuccess = false;
                } else
                    bufferTemp = buffer.slice(point, point + this.recordLength);

                record = [];
                i = 0;
                curPoint = 1;
                this.amount++;

                for (var _j = 0; _j < this.fields.length; _j++) {
                    field = this.fields[_j];
                    if (field.name === '')
                        curPoint += field.length;
                    else
                        record[i++] = this._parseField(curPoint, curPoint += this.fields[_j].length, field,bufferTemp);
                }

                //if (residueBuffer) {
                //    console.log('residueBuffer: ', iconv.decode(residueBuffer, this.encoding).replace(/^\x20+|\x20+$/g, ''));
                //}

                if (((this.amount < this.rowsNumder) || (this.rowsNumder === 0)) && (lim_buf !== this.amount)) {
                    if (event === 'start') {
                        lim_buf = this.amount;
                        _results.push(this.emit('record', record));
                    } else {
                        console.log('Цикл попытался произвести избыточные операции!');
                        i_i = 0;
                        this.amount = 0;
                        lim_buf = 0;
                        return;
                    }
                }
                else if (((this.amount === this.rowsNumder) || (this.rowsNumder === 0)) && (lim_buf !== this.amount)) {
                    lim_buf = this.amount;
                    _results.push(this.emit('record', record));
                    _results.push(this.emit('end'));
                    i_i = 0;
                    event = 'end';
                } else {
                    console.log('ELSE!!!', this.amount, lim_buf);
                    this.amount = 0;
                    lim_buf = 0;
                    i_i = 0;
                    event = 'end';
                    return;
                }
            }
            return _results;
        };

        DBFParser.prototype._parseField = function (begin, end, field, buffer) {
            var dd, mm, value, yy;
            switch (field.type) {
                case 'C':
                    value = iconv.decode(buffer.slice(begin, end), this.encoding).replace(/^\x20+|\x20+$/g, '');
                    if (value) {
                        if (this.timeReg1.test(value)) {
                            value = new Date(value);
                        }
                    } else {
                        value = null;
                    }
                    break;
                case 'N':
                case 'F':
                    value = parseFloat(buffer.slice(begin, end));
                    if (isNaN(value)) {
                        value = null;
                    }
                    break;
                case 'L':
                    value = buffer.slice(begin, end).toString();
                    if (value === 'Y' || value === 'y' || value === 'T' || value === 't') {
                        value = true;
                    } else if (value === 'N' || value === 'n' || value === 'F' || value === 'f') {
                        value = false;
                    } else {
                        value = null;
                    }
                    break;
                case 'D':
                    yy = parseInt(buffer.slice(begin, begin + 4));
                    mm = parseInt(buffer.slice(begin + 4, begin + 6) - 1);
                    dd = parseInt(buffer.slice(begin + 6, begin + 8));
                    if (isNaN(yy)) {
                        value = null;
                    } else {
                        value = new Date(yy, mm, dd);
                    }
                    break;
                default:
                    value = (buffer.slice(begin, end)).toString().replace(/^\x20+|\x20+$/g, '');
                    if (!value) {
                        value = null;
                    }
            }
            return {
                name: field.name,
                value: value
            };
        };

        return DBFParser;

    })(EventEmitter);

    module.exports = DBFParser;

}).call(this);