// カードクラス
class Card {
    constructor(type, data, id) {
        this.type = type; // 'rhythm' または 'pitch'
        this.data = data; // リズム: [8,8,4] など、音程: ['C4','E4','G4'] など
        this.id = id;
        this.element = null;
        this.isLocked = false;
        this.isWaiting = false;
        this.position = null; // 五線紙上の位置
    }

    // カードのDOM要素を作成
    createElement() {
        const card = document.createElement('div');
        card.className = `card ${this.type}-card`;
        card.dataset.cardId = this.id;
        card.draggable = true;

        const content = document.createElement('div');
        content.className = 'card-content';
        
        if (this.type === 'rhythm') {
            content.textContent = this.data.join('');
        } else {
            content.textContent = this.data.join(' ');
        }

        card.appendChild(content);
        this.element = card;
        return card;
    }

    // カードの長さ（8分音符単位）を取得
    getLength() {
        if (this.type === 'rhythm') {
            return this.data.reduce((sum, val) => sum + val, 0);
        }
        return this.data.length * 2; // 音程カードはデフォルトで2（8分音符）ずつ
    }

    // カードを確定状態にする
    lock() {
        this.isLocked = true;
        this.isWaiting = false;
        if (this.element) {
            this.element.classList.add('locked');
            this.element.classList.remove('waiting');
        }
    }

    // カードを待機状態にする
    setWaiting() {
        this.isWaiting = true;
        if (this.element) {
            this.element.classList.add('waiting');
        }
    }

    // カードの待機状態を解除
    clearWaiting() {
        this.isWaiting = false;
        if (this.element) {
            this.element.classList.remove('waiting');
        }
    }

    // カードをリセット
    reset() {
        this.isLocked = false;
        this.isWaiting = false;
        this.position = null;
        if (this.element) {
            this.element.classList.remove('locked', 'waiting');
        }
    }
}

// カード生成ユーティリティ
class CardGenerator {
    // リズムカードを生成
    static generateRhythmCard() {
        const patterns = [
            [8, 8, 4],      // 単調
            [4, 8, 8],      // スキップ
            [8, 4, 8],      // ジャンプ
            [8, 8, 8, 8],   // 均等
            [4, 4, 8],      // 躓き
            [8, 4, 4, 8],   // 複合
        ];
        const pattern = patterns[Math.floor(Math.random() * patterns.length)];
        return pattern;
    }

    // 音程カードを生成
    static generatePitchCard() {
        const patterns = [
            // 同じ音を繰り返す
            () => {
                const note = this.randomNote();
                return [note, note, note];
            },
            // 2音を繰り返す
            () => {
                const note1 = this.randomNote();
                const note2 = this.randomNote();
                return [note1, note2, note1, note2];
            },
            // 上行形
            () => {
                const start = Math.floor(Math.random() * 5) + 3; // C3-G3
                return [
                    this.noteFromNumber(start, 4),
                    this.noteFromNumber(start + 1, 4),
                    this.noteFromNumber(start + 2, 4)
                ];
            },
            // 下行形
            () => {
                const start = Math.floor(Math.random() * 5) + 5; // E4-A4
                return [
                    this.noteFromNumber(start, 4),
                    this.noteFromNumber(start - 1, 4),
                    this.noteFromNumber(start - 2, 4)
                ];
            },
            // ランダム
            () => {
                return [
                    this.randomNote(),
                    this.randomNote(),
                    this.randomNote()
                ];
            },
            // 和音風
            () => {
                const root = Math.floor(Math.random() * 7) + 3; // C3-G3
                return [
                    this.noteFromNumber(root, 4),
                    this.noteFromNumber(root + 2, 4),
                    this.noteFromNumber(root + 4, 4)
                ];
            }
        ];

        const pattern = patterns[Math.floor(Math.random() * patterns.length)];
        return pattern();
    }

    // ランダムなノートを生成
    static randomNote() {
        const notes = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
        const octaves = [3, 4, 5];
        const note = notes[Math.floor(Math.random() * notes.length)];
        const octave = octaves[Math.floor(Math.random() * octaves.length)];
        return `${note}${octave}`;
    }

    // 番号からノート名を生成
    static noteFromNumber(num, octave) {
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const noteIndex = num % 12;
        const oct = octave + Math.floor(num / 12);
        return `${notes[noteIndex]}${oct}`;
    }
}

