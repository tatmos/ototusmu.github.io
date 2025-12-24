// 五線紙クラス
class Staff {
    constructor(canvas, timeSignature = { numerator: 4, denominator: 4 }) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.timeSignature = timeSignature;
        this.beatsPerMeasure = timeSignature.numerator;
        this.beatValue = timeSignature.denominator;
        this.eighthNotesPerMeasure = this.beatsPerMeasure * (8 / this.beatValue); // 8分音符の数
        
        this.cards = []; // 配置されたカード
        this.maxMeasures = 16;
        this.eighthNoteWidth = 30; // 8分音符1つの幅（ピクセル）
        this.staffHeight = 200;
        this.staffLineSpacing = 20;
        this.staffTop = 50;
        
        this.setupCanvas();
        this.draw();
    }

    setupCanvas() {
        const totalWidth = this.maxMeasures * this.eighthNotesPerMeasure * this.eighthNoteWidth + 200;
        this.canvas.width = totalWidth;
        this.canvas.height = this.staffHeight + 100;
    }

    // 五線紙を描画
    draw() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // 背景
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // 拍子記号を描画
        this.drawTimeSignature();

        // 小節線を描画
        this.drawMeasureLines();

        // 五線を描画
        this.drawStaffLines();

        // 配置されたカードを描画
        this.drawCards();
    }

    // 拍子記号を描画
    drawTimeSignature() {
        const ctx = this.ctx;
        ctx.fillStyle = '#000';
        ctx.font = 'bold 24px Arial';
        ctx.fillText(
            `${this.timeSignature.numerator}/${this.timeSignature.denominator}`,
            20,
            this.staffTop + 40
        );
    }

    // 小節線を描画
    drawMeasureLines() {
        const ctx = this.ctx;
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;

        for (let measure = 0; measure <= this.maxMeasures; measure++) {
            const x = 100 + measure * this.eighthNotesPerMeasure * this.eighthNoteWidth;
            ctx.beginPath();
            ctx.moveTo(x, this.staffTop - 10);
            ctx.lineTo(x, this.staffTop + this.staffLineSpacing * 4 + 10);
            ctx.stroke();
        }
    }

    // 五線を描画
    drawStaffLines() {
        const ctx = this.ctx;
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;

        for (let i = 0; i < 5; i++) {
            const y = this.staffTop + i * this.staffLineSpacing;
            ctx.beginPath();
            ctx.moveTo(100, y);
            ctx.lineTo(this.canvas.width - 50, y);
            ctx.stroke();
        }
    }

    // ノートを描画
    drawNote(x, y, note, duration) {
        const ctx = this.ctx;
        
        // ノートの位置を計算（C4を中央の線に配置）
        const notePositions = {
            'C4': 2, 'D4': 1.5, 'E4': 1, 'F4': 0.5, 'G4': 0,
            'A4': -0.5, 'B4': -1, 'C5': -1.5,
            'C3': 3, 'D3': 2.5, 'E3': 2, 'F3': 1.5, 'G3': 1,
            'A3': 0.5, 'B3': 0
        };

        const baseY = this.staffTop + this.staffLineSpacing * 2; // C4の位置
        const noteOffset = (notePositions[note] || 0) * this.staffLineSpacing;
        const noteY = baseY - noteOffset;

        // 音符の頭を描画
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(x, noteY, 8, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // 音符の長さに応じて旗を描画
        if (duration <= 4) { // 8分音符以下
            ctx.beginPath();
            ctx.moveTo(x + 8, noteY);
            ctx.lineTo(x + 8, noteY - 30);
            ctx.stroke();
            
            if (duration <= 2) { // 16分音符
                ctx.beginPath();
                ctx.moveTo(x + 8, noteY - 20);
                ctx.lineTo(x + 12, noteY - 15);
                ctx.stroke();
            }
        }
    }

    // 配置されたカードを描画
    drawCards() {
        this.cards.forEach(cardData => {
            if (!cardData.card || !cardData.position) return;

            const startEighth = cardData.position.eighthNote;
            const x = 100 + startEighth * this.eighthNoteWidth;

            // 組み合わせられたカード（リズム+音程）を描画
            if (cardData.combined) {
                const rhythmCard = cardData.rhythmCard;
                const pitchCard = cardData.pitchCard;
                
                if (rhythmCard && pitchCard && rhythmCard.data && pitchCard.data) {
                    let currentX = x;
                    let pitchIndex = 0;
                    
                    rhythmCard.data.forEach((rhythmDuration) => {
                        if (pitchIndex < pitchCard.data.length) {
                            const note = pitchCard.data[pitchIndex];
                            const duration = rhythmDuration;
                            const noteX = currentX;
                            
                            this.drawNote(noteX, 0, note, duration);
                            
                            currentX += duration * this.eighthNoteWidth;
                            pitchIndex++;
                        } else if (pitchIndex < pitchCard.data.length) {
                            // リズムが足りない場合は最後の音を延長
                            const note = pitchCard.data[pitchIndex - 1];
                            const duration = rhythmDuration;
                            this.drawNote(currentX, 0, note, duration);
                            currentX += duration * this.eighthNoteWidth;
                        }
                    });
                }
            } else if (cardData.card && cardData.card.type === 'pitch' && cardData.card.data) {
                // 単独の音程カード（デフォルトのリズムで）
                cardData.card.data.forEach((note, index) => {
                    const noteX = x + index * this.eighthNoteWidth * 2;
                    this.drawNote(noteX, 0, note, 2);
                });
            } else if (cardData.card && cardData.card.type === 'rhythm') {
                // 単独のリズムカード（視覚的な表示のみ）
                const ctx = this.ctx;
                ctx.fillStyle = 'rgba(255, 107, 107, 0.3)';
                const width = cardData.card.getLength() * this.eighthNoteWidth;
                ctx.fillRect(x, this.staffTop - 10, width, this.staffLineSpacing * 4 + 20);
            }
        });
    }

    // マウス/タッチ位置から8分音符の位置を取得
    getEighthNoteFromPosition(clientX, clientY) {
        const canvasRect = this.canvas.getBoundingClientRect();
        const relativeX = clientX - canvasRect.left - 100;
        const eighthNote = Math.floor(relativeX / this.eighthNoteWidth);
        return Math.max(0, Math.min(eighthNote, this.maxMeasures * this.eighthNotesPerMeasure - 1));
    }

    // カードを配置（既存のカードと組み合わせる可能性をチェック）
    placeCard(card, eighthNotePosition) {
        // 既に配置されている場合は削除
        this.cards = this.cards.filter(c => {
            if (c.combined) {
                return c.rhythmCard.id !== card.id && c.pitchCard.id !== card.id;
            }
            return c.card.id !== card.id;
        });

        // 同じ位置に既存のカードがあるかチェック（組み合わせ可能か）
        const existingCard = this.findCardAtPosition(eighthNotePosition);
        
        if (existingCard && existingCard.card && !existingCard.combined) {
            // 既存のカードと組み合わせ可能かチェック
            const canCombine = 
                (existingCard.card.type === 'rhythm' && card.type === 'pitch') ||
                (existingCard.card.type === 'pitch' && card.type === 'rhythm');
            
            if (canCombine) {
                // カードを組み合わせる
                const rhythmCard = existingCard.card.type === 'rhythm' ? existingCard.card : card;
                const pitchCard = existingCard.card.type === 'pitch' ? existingCard.card : card;
                
                // 既存のカードを削除
                this.cards = this.cards.filter(c => c.card.id !== existingCard.card.id);
                
                const combinedData = {
                    combined: true,
                    rhythmCard: rhythmCard,
                    pitchCard: pitchCard,
                    position: {
                        eighthNote: eighthNotePosition
                    }
                };
                
                this.cards.push(combinedData);
                rhythmCard.position = combinedData.position;
                pitchCard.position = combinedData.position;
                this.draw();
                return;
            }
        }

        // 単独で配置
        const cardData = {
            card: card,
            position: {
                eighthNote: eighthNotePosition
            }
        };

        this.cards.push(cardData);
        card.position = cardData.position;
        this.draw();
    }

    // 指定位置のカードを検索
    findCardAtPosition(eighthNotePosition) {
        return this.cards.find(cardData => {
            if (!cardData.position) return false;
            const start = cardData.position.eighthNote;
            const length = cardData.combined 
                ? (cardData.rhythmCard ? cardData.rhythmCard.getLength() : 0)
                : cardData.card.getLength();
            return eighthNotePosition >= start && eighthNotePosition < start + length;
        });
    }

    // カードを削除
    removeCard(cardId) {
        this.cards = this.cards.filter(c => c.card.id !== cardId);
        this.draw();
    }

    // 小節が完全に埋まっているかチェック
    checkMeasureComplete(measureIndex) {
        const measureStart = measureIndex * this.eighthNotesPerMeasure;
        const measureEnd = measureStart + this.eighthNotesPerMeasure;

        // この小節内のカードを取得
        const measureCards = this.cards.filter(cardData => {
            const start = cardData.position.eighthNote;
            const length = cardData.combined
                ? (cardData.rhythmCard ? cardData.rhythmCard.getLength() : 0)
                : (cardData.card ? cardData.card.getLength() : 0);
            const end = start + length;
            return start >= measureStart && end <= measureEnd;
        });

        // 小節が完全に埋まっているかチェック
        const filledEighths = new Set();
        measureCards.forEach(cardData => {
            const start = cardData.position.eighthNote;
            const length = cardData.combined
                ? (cardData.rhythmCard ? cardData.rhythmCard.getLength() : 0)
                : (cardData.card ? cardData.card.getLength() : 0);
            for (let i = 0; i < length; i++) {
                filledEighths.add(start + i);
            }
        });

        // 小節内のすべての8分音符が埋まっているか
        for (let i = measureStart; i < measureEnd; i++) {
            if (!filledEighths.has(i)) {
                return false;
            }
        }

        return measureCards.length > 0;
    }

    // 確定された小節のリストを取得
    getCompletedMeasures() {
        const completed = [];
        for (let i = 0; i < this.maxMeasures; i++) {
            if (this.checkMeasureComplete(i)) {
                completed.push(i);
            }
        }
        return completed;
    }

    // 待機状態のカードをチェック（小節が完全でない場合）
    checkWaitingCards() {
        this.cards.forEach(cardData => {
            if (cardData.combined) {
                const rhythmCard = cardData.rhythmCard;
                const pitchCard = cardData.pitchCard;
                
                if (rhythmCard && !rhythmCard.isLocked) {
                    const measureIndex = Math.floor(
                        cardData.position.eighthNote / this.eighthNotesPerMeasure
                    );
                    
                    if (!this.checkMeasureComplete(measureIndex)) {
                        rhythmCard.setWaiting();
                        pitchCard.setWaiting();
                    } else {
                        rhythmCard.clearWaiting();
                        pitchCard.clearWaiting();
                    }
                }
            } else if (cardData.card && !cardData.card.isLocked) {
                const measureIndex = Math.floor(
                    cardData.position.eighthNote / this.eighthNotesPerMeasure
                );
                
                if (!this.checkMeasureComplete(measureIndex)) {
                    cardData.card.setWaiting();
                } else {
                    cardData.card.clearWaiting();
                }
            }
        });
    }
}

