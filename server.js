const express = require('express');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const { WavEncoder } = require('wav-encoder');

const app = express();
const port = 3000;

app.use(express.static('public'));

app.get('/api/generate-melody', async (req, res) => {
  const duration = parseInt(req.query.duration);
  const melody = generateMelody(duration);
  const filename = `${uuidv4()}.wav`;
  const wavData = await createWavFile(melody);
  const filePath = `generated/${filename}`;

  fs.writeFileSync(filePath, wavData);

  res.set('Content-Type', 'audio/wav');
  res.set('Content-Disposition', `attachment; filename=${filename}`);
  res.send(wavData);
});

function generateMelody(duration) {
  const tempo = 120;
  const noteDuration = 0.5;

  const totalBeats = duration * tempo;
  const noteFrequencies = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88];

  const melody = [];
  let currentTime = 0;

  for (let i = 0; i < totalBeats; i++) {
    const noteIndex = Math.floor(Math.random() * noteFrequencies.length);
    const frequency = noteFrequencies[noteIndex];
    const noteTime = currentTime + i * noteDuration;

    melody.push({
      frequency,
      startTime: noteTime,
      endTime: noteTime + noteDuration
    });
  }

  return melody;
}

async function createWavFile(melody) {
  const sampleRate = 44100;
  const numberOfChannels = 1;
  const bitDepth = 16;
  const duration = melody[melody.length - 1].endTime;
  const totalSamples = Math.floor(duration * sampleRate);
  const buffer = new ArrayBuffer(44 + totalSamples * 2);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 32 + totalSamples * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2 * numberOfChannels, true);
  view.setUint16(32, numberOfChannels * 2, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, totalSamples * 2, true);

  const channelData = [new Float32Array(totalSamples)];
  for (const note of melody) {
    const noteSamples = Math.floor((note.endTime - note.startTime) * sampleRate);
    const startIndex = Math.floor(note.startTime * sampleRate);
    const frequency = note.frequency;

    for (let i = 0; i < noteSamples; i++) {
      const t = i / sampleRate;
      const value = Math.sin(2 * Math.PI * frequency * t);
      channelData[0][startIndex + i] = value;
    }
  }
  const pcmSamples = channelData.map((channel) => {
    const samples = new Int16Array(channel.length);
    for (let i = 0; i < channel.length; i++) {
      const sample = Math.max(-1, Math.min(1, channel[i]));
      samples[i] = Math.floor(sample * 32767);
    }
    return samples;
  });
  let offset = 44;
  for (let i = 0; i < totalSamples; i++) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const sample = pcmSamples[channel][i];
      view.setInt16(offset, sample, true);
      offset += 2;
    }
  }

  return Buffer.from(view.buffer);
}
function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
