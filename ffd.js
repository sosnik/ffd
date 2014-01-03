var httpAgent = require('http-agent'),
	jsdom = require('jsdom'),
	request = require('request'),
	fs = require('fs');

var id = process.argv[2];
var dir = "Stories";

request({ uri:'https://www.fanfiction.net/s/' + id }, function (error, response, body) {
	if (error && response.statusCode !== 200) {
		console.log('Error contacting fanfiction.net');
		process.exit(-1);
	}

	fs.mkdir(dir);

	jsdom.env({
		html: body,
		scripts: [ 'http://code.jquery.com/jquery-2.0.2.min.js' ],
		done: function (er, window) {
			var $ = window.jQuery;
			var n = $('span select#chap_select option').length;

			if (n === 0)
				n = 1; // we still got one chapter

			console.log('Got ' + n + ' chapters');

			if (n > 0) {
				// get title
				var	title = $('b.xcontrast_txt').text()
				console.log('Got title: ' + title)

				// create file
				var out = fs.createWriteStream(dir + '/' + title.replace(/[\\/:*?"<>|]/g, " ") + '.rtf', { flags: 'w' });

				writeHeader(out);
				writeTitle(out, title);

				var chs = [];
				for (var i = 1; i <= n; i++) {
					chs.push('s/' + id + '/' + i);
				}

				var agent = httpAgent.create('www.fanfiction.net', chs);
				var curChapter = 1;

				agent.addListener('next', function (err, agent) {
					if (err)
						console.log("ERROR: " + err);
					else
						jsdom.env({
							html: agent.body,
							scripts: [ 'http://code.jquery.com/jquery-2.0.2.min.js' ],
							done: function (err, window) {
								console.log('Writing chapter ' + curChapter);

								var $ = window.jQuery;
								var ok = out.write('\\ql\\b Chapter ' + curChapter + '\\b0\\\n');
								if (!ok)
									console.log('ERROR: writing chapter number');

								html2Rtf(window.jQuery, $('#storytext'), 0)
								out.write(unicodeEscape($('#storytext').html()), function() {
									curChapter++;
									agent.next();
								});
							}
						});
				});

				agent.addListener('stop', function (agent) {
					writeFooter(out, function() {
						console.log('That\'s it, folks. All done!');
						process.exit(0);
					});
				});

				agent.start();
			}
		}
	});
});

function writeHeader(stream) {
	stream.write('{\\rtf1\\ansi\\ansicpg1252\\deffont0\\deflang1033');

	stream.write('{\\fonttbl {\\f0\\fnil\\fcharset1\\fprq0 Calibri;}}');

	stream.write('{\\colortbl;\\red0\\green0\\blue0;\\red0\\green0\\blue255;');
	stream.write('\\red0\\green255\\blue255;\\red0\\green255\\blue0;');
	stream.write('\\red255\\green0\\blue255;\\red255\\green0\\blue0;\\red255\\green255\\blue0;');
	stream.write('\\red255\\green255\\blue255;\\red0\\green0\\blue128;\\red0\\green128\\blue128;');
	stream.write('\\red0\\green128\\blue0;\\red128\\green0\\blue128;\\red128\\green0\\blue0;');
	stream.write('\\red128\\green128\\blue0;\\red128\\green128\\blue128;\\red192\\green192\\blue192;}\n');

	stream.write('\\paperw11900\\paperh16840\\margl1440\\margr1440\\vieww10800\\viewh8400\\viewkind0\n');
	stream.write('\\deftab720\n');
	stream.write('\\pard\\tx566\\tx1133\\tx1700\\tx2267\\tx2834\\tx3401\\tx3968\\tx4535\\tx5102\\tx5669\\tx6236\\tx6803\\pardeftab720\\sb100\\sa100\\pardirnatural\n');
}

function writeTitle(stream, title) {
	stream.write('\\ql\\b ' + title + '\\b0\\\n');
}

function writeFooter(stream, onDone) {
	stream.write('}', onDone);
}

function html2Rtf($, el, level) {
	el.children().each(function() {
		if (level < 10)
			html2Rtf($, $(this), level + 1);
		else
			console.log('ERROR: Too many levels (' + $(this) + ')');
	});

	var tag = el.prop('tagName');
	var txt = el.html();

	if (tag === 'P')
		el.replaceWith(txt + '\\\n');
	else if (tag === 'HR')
		el.replaceWith('#-#-#\\\n');
	else if (tag === 'BR')
		el.replaceWith('\\line');
	else if (tag === 'STRONG')
		el.replaceWith('\\b ' + txt + '\\b0 ');
	else if (tag === 'EM')
		el.replaceWith('\\i ' + txt + '\\i0 ');
	else if (tag === 'SPAN' && el.attr('style').indexOf("underline;") != -1)
	el.replaceWith('\\ul ' + txt + '\\ul0 ');
	else if (tag === 'DIV' && level === 0)
		; // do nothing, body
	else
		console.log('ERROR: Unknown tag ' + tag);
}

function unicodeEscape(str) {
	return str.replace(/[\s\S]/g, function(character) {
		return character.charCodeAt() < 0x80 ? character : '\\u' + character.charCodeAt().toString(10) + '?';
	});
}
