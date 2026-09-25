const { readGedcom } = require('read-gedcom');
const head = '0 HEAD\n1 CHAR ANSEL\n1 GEDC\n2 VERS 5.5.1\n0 @I1@ INDI\n1 NAME Se';
const tail = 'an /Dvo';
const buf = Buffer.concat([Buffer.from(head,'latin1'), Buffer.from([0xE2]), Buffer.from(tail,'latin1'), Buffer.from([0xE9]), Buffer.from('rak/\n0 TRLR\n','latin1')]);
const g = readGedcom(buf.buffer.slice(buf.byteOffset, buf.byteOffset+buf.length));
const name = g.getIndividualRecord().getName().value()[0];
console.log(JSON.stringify(name), name.length, 'NFC equal?', name === name.normalize('NFC'), JSON.stringify(name.normalize('NFC')));
