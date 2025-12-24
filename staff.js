// 五線紙クラス（ピアノロール形式）
class Staff {
    constructor(canvas, timeSignature = { numerator: 4, denominator: 4 }, game = null) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.timeSignature = timeSignature;
        this.beatsPerMeasure = timeSignature.numerator;
        this.beatValue = timeSignature.denominator;
        this.eighthNotesPerMeasure = this.beatsPerMeasure * (8 / this.beatValue); // 8分音符の数
        this.game = game; // Gameインスタンスへの参照
        
        this.cards = []; // 配置されたカード
        this.maxMeasures = 16;
        this.eighthNoteWidth = 30; // 8分音符1つの幅（ピクセル）
        this.blockHeight = 25; // ブロックの高さ（ピクセル）
        this.leftMargin = 100; // 左マージン（音程ラベル用）
        this.topMargin = 30; // 上マージン
        
        // 音程の範囲（C3からC5まで）
        this.notes = this.generateNoteRange('C3', 'C5');
        
        // 音程ごとの色マッピング
        this.noteColors = this.generateNoteColors();
        
        this.setupCanvas();
        this.draw();
    }

    // 音程範囲を生成
    generateNoteRange(startNote, endNote) {
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const range = [];
        
        const parseNote = (noteStr) => {
            const match = noteStr.match(/([A-G]#?)(\d)/);
            if (!match) return null;
            const noteName = match[1];
            const octave = parseInt(match[2]);
            const noteIndex = notes.indexOf(noteName);
            return { noteIndex, octave, fullName: noteStr };
        };
        
        const start = parseNote(startNote);
        const end = parseNote(endNote);
        if (!start || !end) return [];
        
        let currentOctave = start.octave;
        let currentNoteIndex = start.noteIndex;
        const endOctave = end.octave;
        const endNoteIndex = end.noteIndex;
        
        while (currentOctave < endOctave || (currentOctave === endOctave && currentNoteIndex <= endNoteIndex)) {
            range.push(notes[currentNoteIndex] + currentOctave);
            currentNoteIndex++;
            if (currentNoteIndex >= notes.length) {
                currentNoteIndex = 0;
                currentOctave++;
            }
        }
        
        return range.reverse(); // 高い音から低い音へ（上から下へ）
    }

    // 音程ごとの色を生成
    generateNoteColors() {
        const colors = {};
        const baseColors = {
            'C': '#FF6B6B',   // 赤
            'C#': '#FF8E6B',  // オレンジ
            'D': '#FFB84D',   // 黄オレンジ
            'D#': '#FFD93D',  // 黄色
            'E': '#C8E6C9',   // ライトグリーン
            'F': '#81C784',   // グリーン
            'F#': '#4FC3F7',  // ライトブルー
            'G': '#42A5F5',   // ブルー
            'G#': '#7986CB',  // インディゴ
            'A': '#BA68C8',   // パープル
            'A#': '#E91E63',  // ピンク
            'B': '#F06292'    // ローズ
        };
        
        this.notes.forEach(note => {
            const noteName = note.replace(/\d+/, '');
            colors[note] = baseColors[noteName] || '#CCCCCC';
        });
        
        return colors;
    }

    setupCanvas() {
        const totalWidth = this.maxMeasures * this.eighthNotesPerMeasure * this.eighthNoteWidth + this.leftMargin + 50;
        const totalHeight = this.notes.length * this.blockHeight + this.topMargin + 50;
        this.canvas.width = totalWidth;
        this.canvas.height = totalHeight;
    }

    // ピアノロールを描画
    draw(playPosition = null) {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // 背景
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // 拍子記号を描画
        this.drawTimeSignature();

        // 音程ラベルとグリッド線を描画
        this.drawPianoRollGrid();

        // 小節線を描画
        this.drawMeasureLines();

        // 配置されたカードを描画
        this.drawCards();

        // 8分音符の区切り線を描画（カードの上に描画して見やすく）
        this.drawEighthNoteLines();

        // 再生ポジションをハイライト
        if (playPosition !== null) {
            this.drawPlayPosition(playPosition);
        }
    }

    // 再生ポジションをハイライト
    drawPlayPosition(eighthNotePosition) {
        const ctx = this.ctx;
        const x = this.leftMargin + eighthNotePosition * this.eighthNoteWidth;
        const y = this.topMargin;
        const height = this.notes.length * this.blockHeight;
        
        // 再生ポジションの線を描画
        ctx.strokeStyle = '#ff6b6b';
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + height);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // 拍子記号を描画
    drawTimeSignature() {
        const ctx = this.ctx;
        ctx.fillStyle = '#000';
        ctx.font = 'bold 20px Arial';
        ctx.fillText(
            `${this.timeSignature.numerator}/${this.timeSignature.denominator}`,
            10,
            20
        );
    }

    // ピアノロールのグリッドと音程ラベルを描画
    drawPianoRollGrid() {
        const ctx = this.ctx;
        
        // 各音程の行を描画
        this.notes.forEach((note, index) => {
            const y = this.topMargin + index * this.blockHeight;
            
            // 行の背景（交互に色を変える）
            ctx.fillStyle = index % 2 === 0 ? '#f8f9fa' : '#ffffff';
            ctx.fillRect(this.leftMargin, y, this.canvas.width - this.leftMargin, this.blockHeight);
            
            // 音程ラベル
            ctx.fillStyle = '#333';
            ctx.font = '12px Arial';
            ctx.textAlign = 'right';
            ctx.fillText(note, this.leftMargin - 10, y + this.blockHeight / 2 + 4);
            
            // 横線
            ctx.strokeStyle = '#ddd';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(this.leftMargin, y + this.blockHeight);
            ctx.lineTo(this.canvas.width - 50, y + this.blockHeight);
            ctx.stroke();
        });
    }

    // 小節線を描画
    drawMeasureLines() {
        const ctx = this.ctx;
        ctx.strokeStyle = '#999';
        ctx.lineWidth = 2;

        for (let measure = 0; measure <= this.maxMeasures; measure++) {
            const x = this.leftMargin + measure * this.eighthNotesPerMeasure * this.eighthNoteWidth;
            ctx.beginPath();
            ctx.moveTo(x, this.topMargin);
            ctx.lineTo(x, this.topMargin + this.notes.length * this.blockHeight);
            ctx.stroke();
        }
    }

    // 8分音符の区切り線を描画
    drawEighthNoteLines() {
        const ctx = this.ctx;
        ctx.strokeStyle = '#666666'; // 濃いグレーで見やすく
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]); // 点線にして見やすく

        const totalEighthNotes = this.maxMeasures * this.eighthNotesPerMeasure;
        
        for (let eighthNote = 0; eighthNote <= totalEighthNotes; eighthNote++) {
            const x = this.leftMargin + eighthNote * this.eighthNoteWidth;
            
            // 小節線の位置はスキップ（既に描画されているため）
            if (eighthNote % this.eighthNotesPerMeasure === 0) {
                continue;
            }
            
            ctx.beginPath();
            ctx.moveTo(x, this.topMargin);
            ctx.lineTo(x, this.topMargin + this.notes.length * this.blockHeight);
            ctx.stroke();
        }
        
        ctx.setLineDash([]); // 点線をリセット
    }

    // 音程名からY座標を取得
    getNoteY(note) {
        const index = this.notes.indexOf(note);
        if (index === -1) return null;
        return this.topMargin + index * this.blockHeight;
    }

    // ブロックを描画（リズムのみ：グレースケール）
    drawRhythmBlock(x, duration, brightness = 0.5) {
        const ctx = this.ctx;
        const width = duration * this.eighthNoteWidth;
        const y = this.topMargin;
        const height = this.notes.length * this.blockHeight;
        
        // グレースケールで描画（明暗で表現）
        const grayValue = Math.floor(255 * brightness);
        ctx.fillStyle = `rgb(${grayValue}, ${grayValue}, ${grayValue})`;
        ctx.fillRect(x, y, width, height);
        
        // 境界線
        ctx.strokeStyle = '#999';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, width, height);
    }

    // ブロックを描画（音程のみ：色つき、1ブロックに音名）
    drawPitchBlock(x, note) {
        const ctx = this.ctx;
        const noteY = this.getNoteY(note);
        if (noteY === null) return;
        
        const width = this.eighthNoteWidth; // 1ブロック（8分音符）
        const height = this.blockHeight;
        
        // 色つきブロック
        ctx.fillStyle = this.noteColors[note] || '#CCCCCC';
        ctx.fillRect(x, noteY, width, height);
        
        // 境界線
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, noteY, width, height);
        
        // 音名を表示
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(note, x + width / 2, noteY + height / 2 + 3);
    }

    // ブロックを描画（リズム+音程融合：リズムブロックに色と音名）
    drawCombinedBlock(x, note, duration) {
        const ctx = this.ctx;
        const noteY = this.getNoteY(note);
        if (noteY === null) return;
        
        const width = duration * this.eighthNoteWidth;
        const height = this.blockHeight;
        
        // 色つきブロック
        ctx.fillStyle = this.noteColors[note] || '#CCCCCC';
        ctx.fillRect(x, noteY, width, height);
        
        // 境界線
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, noteY, width, height);
        
        // 音名を表示（ブロックが十分広い場合）
        if (width >= this.eighthNoteWidth) {
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 10px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(note, x + width / 2, noteY + height / 2 + 3);
        }
    }

    // 配置されたカードを描画
    drawCards() {
        this.cards.forEach(cardData => {
            // 一時的な位置（ドラッグ中）がある場合はそれを使用
            const position = cardData.tempPosition || cardData.position;
            if (!position) return;

            const startEighth = position.eighthNote;
            const x = this.leftMargin + startEighth * this.eighthNoteWidth;

            // まずブロックを描画
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
                            
                            // リズム+音程融合：色つきブロックに音名
                            this.drawCombinedBlock(currentX, note, duration);
                            
                            currentX += duration * this.eighthNoteWidth;
                            pitchIndex++;
                        } else if (pitchIndex > 0) {
                            // リズムが足りない場合は最後の音を延長
                            const note = pitchCard.data[pitchIndex - 1];
                            const duration = rhythmDuration;
                            this.drawCombinedBlock(currentX, note, duration);
                            currentX += duration * this.eighthNoteWidth;
                        }
                    });
                    
                    // 贈り物パッケージの枠を描画
                    const totalLength = rhythmCard.getLength();
                    const isDragging = !!cardData.tempPosition;
                    this.drawGiftPackageFrame(x, totalLength, 'combined', isDragging);
                }
            } else if (cardData.card) {
                if (cardData.card.type === 'pitch' && cardData.card.data) {
                    // 単独の音程カード：色つきブロックに音名（1ブロックずつ）
                    cardData.card.data.forEach((note, index) => {
                        const noteX = x + index * this.eighthNoteWidth;
                        this.drawPitchBlock(noteX, note);
                    });
                    // 贈り物パッケージの枠を描画
                    const totalLength = cardData.card.getLength();
                    const isDragging = !!cardData.tempPosition;
                    this.drawGiftPackageFrame(x, totalLength, 'pitch', isDragging);
                } else if (cardData.card.type === 'rhythm' && cardData.card.data) {
                    // 単独のリズムカード：グレースケールの明暗で表現
                    let currentX = x;
                    cardData.card.data.forEach((duration, index) => {
                        // リズムの長さに応じて明暗を変える（長いほど明るく）
                        // 8分音符=0.4, 4分音符=0.6, 2分音符=0.8, 1分音符=0.9
                        const brightness = duration === 8 ? 0.4 : duration === 4 ? 0.6 : duration === 2 ? 0.8 : duration === 1 ? 0.9 : 0.5;
                        this.drawRhythmBlock(currentX, duration, brightness);
                        currentX += duration * this.eighthNoteWidth;
                    });
                    // 贈り物パッケージの枠を描画
                    const totalLength = cardData.card.getLength();
                    const isDragging = !!cardData.tempPosition;
                    this.drawGiftPackageFrame(x, totalLength, 'rhythm', isDragging);
                }
            }
        });
    }

    // 贈り物パッケージの枠を描画
    drawGiftPackageFrame(x, length, type, isDragging = false) {
        const ctx = this.ctx;
        const width = length * this.eighthNoteWidth;
        const y = this.topMargin;
        const height = this.notes.length * this.blockHeight;
        
        // 枠の色を決定
        let borderColor, bgColor;
        if (type === 'rhythm') {
            borderColor = '#ff9999';
            bgColor = 'rgba(255, 204, 204, 0.1)';
        } else if (type === 'pitch') {
            borderColor = '#99ccff';
            bgColor = 'rgba(204, 238, 255, 0.1)';
        } else { // combined
            borderColor = '#cc99ff';
            bgColor = 'rgba(238, 204, 255, 0.1)';
        }
        
        // ドラッグ中は半透明にする
        const alpha = isDragging ? 0.5 : 1.0;
        ctx.globalAlpha = alpha;
        
        // 背景（薄く）
        ctx.fillStyle = bgColor;
        ctx.fillRect(x, y, width, height);
        
        // 枠線
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 3;
        ctx.setLineDash(isDragging ? [5, 5] : []);
        ctx.strokeRect(x, y, width, height);
        
        // リボン（上）
        const ribbonWidth = 30;
        const ribbonX = x + width / 2 - ribbonWidth / 2;
        ctx.fillStyle = type === 'rhythm' ? '#ff6b6b' : type === 'pitch' ? '#4ecdc4' : '#cc99ff';
        ctx.fillRect(ribbonX, y, ribbonWidth, 8);
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 1;
        ctx.strokeRect(ribbonX, y, ribbonWidth, 8);
        
        // リボン（下）
        ctx.fillRect(ribbonX, y + height - 8, ribbonWidth, 8);
        ctx.strokeRect(ribbonX, y + height - 8, ribbonWidth, 8);
        
        ctx.globalAlpha = 1.0;
    }

    // マウス/タッチ位置から8分音符の位置を取得
    getEighthNoteFromPosition(clientX, clientY) {
        const canvasRect = this.canvas.getBoundingClientRect();
        const relativeX = clientX - canvasRect.left - this.leftMargin;
        const eighthNote = Math.floor(relativeX / this.eighthNoteWidth);
        return Math.max(0, Math.min(eighthNote, this.maxMeasures * this.eighthNotesPerMeasure - 1));
    }

    // カードを配置（既存のカードと組み合わせる可能性をチェック）
    placeCard(card, eighthNotePosition) {
        // 既に配置されている場合は削除
        this.cards = this.cards.filter(c => {
            if (c.combined) {
                // 組み合わせカードの場合、リズムカードまたは音程カードのいずれかが一致する場合は削除
                const rhythmMatches = c.rhythmCard && c.rhythmCard.id === card.id;
                const pitchMatches = c.pitchCard && c.pitchCard.id === card.id;
                return !rhythmMatches && !pitchMatches;
            }
            // 単独カードの場合、カードが存在し、IDが一致しない場合は残す
            return !c.card || (c.card.id !== card.id);
        });

        // 同じ位置に既存のカードがあるかチェック（組み合わせ可能か）
        let existingCard = this.findCardAtPosition(eighthNotePosition);
        
        // 既存のカードがない場合、最も近いカードを検索
        if (!existingCard) {
            const nearestCard = this.findNearestCard(eighthNotePosition);
            
            // 最も近いカードが見つかった場合、その位置に合わせる
            if (nearestCard) {
                const nearestStart = nearestCard.position.eighthNote;
                const nearestLength = nearestCard.combined 
                    ? (nearestCard.rhythmCard ? nearestCard.rhythmCard.getLength() : 0)
                    : nearestCard.card.getLength();
                const nearestEnd = nearestStart + nearestLength;
                
                // ドロップ位置がカードの範囲内か、終端に近い場合は終端位置に配置
                if (eighthNotePosition >= nearestStart && eighthNotePosition < nearestEnd) {
                    // カードの範囲内の場合は、その位置に配置
                    eighthNotePosition = eighthNotePosition;
                } else if (Math.abs(eighthNotePosition - nearestEnd) <= 4) {
                    // 終端に近い場合は終端位置に配置
                    eighthNotePosition = nearestEnd;
                } else if (Math.abs(eighthNotePosition - nearestStart) <= 4) {
                    // 開始位置に近い場合は開始位置に配置
                    eighthNotePosition = nearestStart;
                } else {
                    // それ以外の場合は、最も近い位置に配置
                    eighthNotePosition = eighthNotePosition < nearestStart ? nearestStart : nearestEnd;
                }
                
                // 位置を調整した後、その位置に既存のカードがあるか再チェック
                existingCard = this.findCardAtPosition(eighthNotePosition);
                
                // 既存のカードが見つからない場合、最も近いカードを使用（合成するため）
                if (!existingCard && nearestCard) {
                    existingCard = nearestCard;
                    // 既存のカードの位置を保持
                    eighthNotePosition = nearestCard.position.eighthNote;
                }
            }
        }
        
        if (existingCard) {
            if (existingCard.combined) {
                // 既に組み合わせられたカードの場合
                // 既にリズムカードと音程カードの両方が存在する場合は、追加合成を拒否
                if (existingCard.rhythmCard && existingCard.pitchCard) {
                    // 合成済みカードには追加できない
                    console.log('既に合成済みのカードには追加できません');
                    return;
                }
                
                // 新しいカードが既存の組み合わせに追加できるかチェック
                if (card.type === 'rhythm' && !existingCard.rhythmCard) {
                    // リズムカードが不足している場合、追加
                    // カード要素をカードコンテナから削除
                    if (card.element && card.element.parentNode) {
                        card.element.parentNode.removeChild(card.element);
                        card.element = null;
                    }
                    existingCard.rhythmCard = card;
                    card.position = existingCard.position;
                    // 合成完了（両方のカードが揃った）のでスコアを加算
                    if (existingCard.rhythmCard && existingCard.pitchCard && this.game) {
                        this.game.addScoreForCombination();
                    }
                    this.draw();
                    return;
                } else if (card.type === 'pitch' && !existingCard.pitchCard) {
                    // 音程カードが不足している場合、追加
                    // カード要素をカードコンテナから削除
                    if (card.element && card.element.parentNode) {
                        card.element.parentNode.removeChild(card.element);
                        card.element = null;
                    }
                    existingCard.pitchCard = card;
                    card.position = existingCard.position;
                    // 合成完了（両方のカードが揃った）のでスコアを加算
                    if (existingCard.rhythmCard && existingCard.pitchCard && this.game) {
                        this.game.addScoreForCombination();
                    }
                    this.draw();
                    return;
                } else if (card.type === 'rhythm' && existingCard.rhythmCard) {
                    // 既にリズムカードがある場合、置き換え
                    // 古いカード要素を削除
                    if (existingCard.rhythmCard.element && existingCard.rhythmCard.element.parentNode) {
                        existingCard.rhythmCard.element.parentNode.removeChild(existingCard.rhythmCard.element);
                        existingCard.rhythmCard.element = null;
                    }
                    existingCard.rhythmCard.reset();
                    // 新しいカード要素を削除
                    if (card.element && card.element.parentNode) {
                        card.element.parentNode.removeChild(card.element);
                        card.element = null;
                    }
                    existingCard.rhythmCard = card;
                    card.position = existingCard.position;
                    this.draw();
                    return;
                } else if (card.type === 'pitch' && existingCard.pitchCard) {
                    // 既に音程カードがある場合、置き換え
                    // 古いカード要素を削除
                    if (existingCard.pitchCard.element && existingCard.pitchCard.element.parentNode) {
                        existingCard.pitchCard.element.parentNode.removeChild(existingCard.pitchCard.element);
                        existingCard.pitchCard.element = null;
                    }
                    existingCard.pitchCard.reset();
                    // 新しいカード要素を削除
                    if (card.element && card.element.parentNode) {
                        card.element.parentNode.removeChild(card.element);
                        card.element = null;
                    }
                    existingCard.pitchCard = card;
                    card.position = existingCard.position;
                    this.draw();
                    return;
                }
            } else if (existingCard.card && !existingCard.combined) {
                // 単独のカードと組み合わせ可能かチェック
                const canCombine = 
                    (existingCard.card.type === 'rhythm' && card.type === 'pitch') ||
                    (existingCard.card.type === 'pitch' && card.type === 'rhythm');
                
                if (canCombine) {
                    // カードを組み合わせる
                    const rhythmCard = existingCard.card.type === 'rhythm' ? existingCard.card : card;
                    const pitchCard = existingCard.card.type === 'pitch' ? existingCard.card : card;
                    
                    // 既存のカードの位置を保持
                    const existingPosition = existingCard.position.eighthNote;
                    
                    // 既存のカードを削除
                    this.cards = this.cards.filter(c => {
                        if (c.combined) {
                            // 組み合わせカードの場合は、リズムカードまたは音程カードのいずれかが一致する場合は削除
                            const rhythmMatches = c.rhythmCard && c.rhythmCard.id === existingCard.card.id;
                            const pitchMatches = c.pitchCard && c.pitchCard.id === existingCard.card.id;
                            return !rhythmMatches && !pitchMatches;
                        }
                        // 単独カードの場合、カードが存在し、IDが一致しない場合は残す
                        return !c.card || (c.card.id !== existingCard.card.id);
                    });
                    
                    // カード要素をカードコンテナから削除
                    if (rhythmCard.element && rhythmCard.element.parentNode) {
                        rhythmCard.element.parentNode.removeChild(rhythmCard.element);
                        rhythmCard.element = null;
                    }
                    if (pitchCard.element && pitchCard.element.parentNode) {
                        pitchCard.element.parentNode.removeChild(pitchCard.element);
                        pitchCard.element = null;
                    }
                    
                    const combinedData = {
                        combined: true,
                        rhythmCard: rhythmCard,
                        pitchCard: pitchCard,
                        position: {
                            eighthNote: existingPosition
                        }
                    };
                    
                    this.cards.push(combinedData);
                    rhythmCard.position = combinedData.position;
                    pitchCard.position = combinedData.position;
                    // 合成完了なのでスコアを加算
                    if (this.game) {
                        this.game.addScoreForCombination();
                    }
                    this.draw();
                    return;
                }
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

    // 指定位置に最も近いカードを検索（範囲内または最も近い）
    findNearestCard(eighthNotePosition) {
        let nearestCard = null;
        let minDistance = Infinity;
        
        this.cards.forEach(cardData => {
            if (!cardData.position) return;
            
            const start = cardData.position.eighthNote;
            const length = cardData.combined 
                ? (cardData.rhythmCard ? cardData.rhythmCard.getLength() : 0)
                : cardData.card.getLength();
            const end = start + length;
            
            let distance;
            if (eighthNotePosition >= start && eighthNotePosition < end) {
                // カードの範囲内にある場合、距離は0
                distance = 0;
            } else if (eighthNotePosition < start) {
                // カードの前にある場合、開始位置までの距離
                distance = start - eighthNotePosition;
            } else {
                // カードの後にある場合、終端位置までの距離
                distance = eighthNotePosition - end;
            }
            
            if (distance < minDistance) {
                minDistance = distance;
                nearestCard = cardData;
            }
        });
        
        // 距離が一定範囲内（8分音符4つ分以内）の場合のみ返す
        if (minDistance <= 4) {
            return nearestCard;
        }
        
        return null;
    }

    // 指定位置の近くにある合成カードの終端位置を検索
    findCardAtEndPosition(eighthNotePosition) {
        // 指定位置の近く（前後数ブロック以内）にある合成カードを検索
        const searchRange = 4; // 8分音符4つ分の範囲
        return this.cards.find(cardData => {
            if (!cardData.position || !cardData.combined) return false;
            const start = cardData.position.eighthNote;
            const length = cardData.rhythmCard ? cardData.rhythmCard.getLength() : 0;
            const end = start + length;
            
            // 指定位置が終端位置の近くにあるかチェック
            return Math.abs(eighthNotePosition - end) <= searchRange;
        });
    }

    // カードの終端位置を取得
    getCardEndPosition(cardData) {
        if (!cardData.position) return 0;
        const start = cardData.position.eighthNote;
        const length = cardData.combined 
            ? (cardData.rhythmCard ? cardData.rhythmCard.getLength() : 0)
            : cardData.card.getLength();
        return start + length;
    }

    // キャンバス上の位置からカードを検索
    findCardAtCanvasPosition(clientX, clientY) {
        const canvasRect = this.canvas.getBoundingClientRect();
        const x = clientX - canvasRect.left;
        const y = clientY - canvasRect.top;
        
        // ピアノロールの範囲内かチェック
        if (x < this.leftMargin || x > this.canvas.width - 50 ||
            y < this.topMargin || y > this.topMargin + this.notes.length * this.blockHeight) {
            return null;
        }
        
        // 8分音符の位置を取得
        const eighthNote = this.getEighthNoteFromPosition(clientX, clientY);
        
        // その位置にあるカードを検索
        return this.findCardAtPosition(eighthNote);
    }

    // カードを削除
    removeCard(cardId) {
        this.cards = this.cards.filter(c => {
            if (c.combined) {
                // 組み合わせカードの場合、リズムカードまたは音程カードのいずれかが一致する場合は削除
                const rhythmMatches = c.rhythmCard && c.rhythmCard.id === cardId;
                const pitchMatches = c.pitchCard && c.pitchCard.id === cardId;
                return !rhythmMatches && !pitchMatches;
            }
            // 単独カードの場合、カードが存在し、IDが一致しない場合は残す
            return !c.card || (c.card.id !== cardId);
        });
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

