// 音の管理クラス
class AudioManager {
    constructor() {
        this.audioContext = null;
        this.oscillators = new Map();
        this.gainNodes = new Map();
        this.isPlaying = false;
        this.scheduledNotes = [];
    }

    init() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.error('Web Audio API is not supported:', e);
        }
    }

    // ノート名（C4, E4など）を周波数に変換
    noteToFrequency(note) {
        const noteMap = {
            'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5,
            'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11
        };
        
        const match = note.match(/([A-G]#?)(\d+)/);
        if (!match) return 440; // デフォルトはA4
        
        const [, noteName, octave] = match;
        const semitone = noteMap[noteName] || 0;
        const octaveNum = parseInt(octave) || 4;
        
        // A4 (440Hz) を基準に計算
        const semitonesFromA4 = (octaveNum - 4) * 12 + semitone - 9;
        return 440 * Math.pow(2, semitonesFromA4 / 12);
    }

    // 単一のノートを再生
    playNote(note, duration, startTime = 0, volume = 0.3) {
        if (!this.audioContext) return;

        const frequency = this.noteToFrequency(note);
        const time = this.audioContext.currentTime + startTime;

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.frequency.value = frequency;
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0, time);
        gainNode.gain.linearRampToValueAtTime(volume, time + 0.01);
        gainNode.gain.linearRampToValueAtTime(0, time + duration - 0.01);

        oscillator.start(time);
        oscillator.stop(time + duration);

        return { oscillator, gainNode };
    }

    // 複数のノートを同時に再生（和音）
    playChord(notes, duration, startTime = 0, volume = 0.2) {
        if (!this.audioContext || !notes || notes.length === 0) return;

        notes.forEach(note => {
            this.playNote(note, duration, startTime, volume / notes.length);
        });
    }

    // ループ再生を開始
    startLoop(notes, rhythm, tempo = 120, volume = 0.2) {
        if (!this.audioContext || this.isPlaying) return;

        this.isPlaying = true;
        this.stopLoop();

        const beatDuration = 60 / tempo; // 4分音符の長さ（秒）
        const eighthNoteDuration = beatDuration / 2; // 8分音符の長さ

        let currentTime = 0;
        const loopDuration = rhythm.reduce((sum, r) => sum + r * eighthNoteDuration, 0);

        const scheduleLoop = () => {
            if (!this.isPlaying) return;

            let timeOffset = 0;
            rhythm.forEach((duration, index) => {
                if (index < notes.length) {
                    const noteDuration = duration * eighthNoteDuration;
                    this.playNote(notes[index], noteDuration, currentTime + timeOffset, volume);
                    timeOffset += noteDuration;
                }
            });

            currentTime += loopDuration;
            setTimeout(scheduleLoop, loopDuration * 1000);
        };

        scheduleLoop();
    }

    // ループ再生を停止
    stopLoop() {
        this.isPlaying = false;
        this.oscillators.forEach(osc => {
            try {
                osc.stop();
            } catch (e) {
                // 既に停止している場合は無視
            }
        });
        this.oscillators.clear();
        this.gainNodes.clear();
    }

    // すべての音を停止
    stopAll() {
        this.stopLoop();
        if (this.audioContext) {
            this.audioContext.suspend();
        }
    }
}

