// メインゲームクラス
class Game {
    constructor() {
        this.audioManager = new AudioManager();
        this.staff = null;
        this.storyManager = new StoryManager();
        
        this.rhythmCards = [];
        this.pitchCards = [];
        this.cardIdCounter = 0;
        
        this.score = 0;
        this.targetScore = 1000;
        this.completedMeasures = new Set();
        this.lockedCards = [];
        
        this.draggedCard = null;
        this.draggedCardData = null;
        this.dragOffset = { x: 0, y: 0 };
        this.isDraggingFromCanvas = false;
        this.isPlayingMusic = false;
        
        this.init();
    }

    init() {
        // オーディオマネージャーを初期化
        this.audioManager.init();

        // キャンバスを取得
        const canvas = document.getElementById('staff-canvas');
        this.staff = new Staff(canvas, { numerator: 4, denominator: 4 });

        // イベントリスナーを設定
        this.setupEventListeners();

        // カードを生成
        this.generateCards();

        // ストーリーを表示
        this.showStory();

        // ユーザー操作でオーディオコンテキストを開始
        const startAudio = () => {
            if (this.audioManager.audioContext && this.audioManager.audioContext.state === 'suspended') {
                this.audioManager.audioContext.resume();
            }
            document.removeEventListener('click', startAudio);
            document.removeEventListener('touchstart', startAudio);
        };
        document.addEventListener('click', startAudio);
        document.addEventListener('touchstart', startAudio);

        // ゲームループを開始
        this.gameLoop();
    }

    setupEventListeners() {
        // ストーリー関連
        const storyOverlay = document.getElementById('story-overlay');
        const storyNextBtn = document.getElementById('story-next-btn');
        storyNextBtn.addEventListener('click', () => {
            const nextStory = this.storyManager.nextStory();
            if (!nextStory) {
                this.storyManager.hideStory(storyOverlay);
            } else {
                this.showStory();
            }
        });

        // ボタン
        document.getElementById('clear-btn').addEventListener('click', () => this.clearStaff());
        document.getElementById('play-btn').addEventListener('click', () => this.playMusic());
        document.getElementById('stop-btn').addEventListener('click', () => this.stopMusic());

        // キャンバスのドラッグ&ドロップ
        this.setupDragAndDrop();

        // カードの生成ボタン（デバッグ用、後で削除可能）
        this.setupCardGeneration();
    }

    setupDragAndDrop() {
        const canvas = this.staff.canvas;
        const cardsContainers = [
            document.getElementById('rhythm-cards-container'),
            document.getElementById('pitch-cards-container')
        ];

        // ドラッグ開始（マウスとタッチの両方に対応）
        const startDrag = (e) => {
            const cardElement = e.target.closest('.card');
            if (!cardElement) {
                // キャンバス上でクリックされた場合、配置されたカードを検出
                const canvasRect = canvas.getBoundingClientRect();
                const clientX = e.touches ? e.touches[0].clientX : e.clientX;
                const clientY = e.touches ? e.touches[0].clientY : e.clientY;
                
                if (clientX >= canvasRect.left && clientX <= canvasRect.right &&
                    clientY >= canvasRect.top && clientY <= canvasRect.bottom) {
                    const cardData = this.staff.findCardAtCanvasPosition(clientX, clientY);
                    if (cardData) {
                        // 配置されたカードをドラッグ開始
                        let card = null;
                        if (cardData.combined) {
                            // 組み合わせカードの場合、リズムカードを基準にする
                            card = cardData.rhythmCard || cardData.pitchCard;
                        } else {
                            card = cardData.card;
                        }
                        
                        if (card && !card.isLocked) {
                            this.draggedCard = card;
                            this.draggedCardData = cardData;
                            
                            // クリック位置からカードの開始位置までの相対オフセットを計算
                            const cardStartX = this.staff.leftMargin + cardData.position.eighthNote * this.staff.eighthNoteWidth;
                            const relativeX = (clientX - canvasRect.left) - cardStartX;
                            const relativeY = (clientY - canvasRect.top) - this.staff.topMargin;
                            
                            this.dragOffset.x = relativeX;
                            this.dragOffset.y = relativeY;
                            this.isDraggingFromCanvas = true;
                            e.preventDefault();
                            return;
                        }
                    }
                }
                return;
            }

            const cardId = parseInt(cardElement.dataset.cardId);
            const card = this.findCardById(cardId);
            if (!card || card.isLocked) return;

            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;

            this.draggedCard = card;
            this.draggedCardData = null;
            this.isDraggingFromCanvas = false;
            const rect = cardElement.getBoundingClientRect();
            this.dragOffset.x = clientX - rect.left;
            this.dragOffset.y = clientY - rect.top;

            cardElement.classList.add('dragging');
            e.preventDefault();
        };

        // ドラッグ中（マウスとタッチの両方に対応）
        const drag = (e) => {
            if (!this.draggedCard) return;

            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;

            if (this.isDraggingFromCanvas) {
                // キャンバス上でドラッグ中は、一時的に枠を表示
                const canvasRect = canvas.getBoundingClientRect();
                const x = clientX - canvasRect.left;
                const y = clientY - canvasRect.top;
                
                // 相対オフセットを考慮して、カードの開始位置を計算
                const cardStartX = x - this.dragOffset.x;
                const cardStartEighth = Math.round((cardStartX - this.staff.leftMargin) / this.staff.eighthNoteWidth);
                
                // 8分音符単位でスナップ（負の値にならないように）
                const eighthNote = Math.max(0, cardStartEighth);
                
                // 一時的な位置を保存（描画用）
                if (this.draggedCardData) {
                    this.draggedCardData.tempPosition = { eighthNote: eighthNote };
                }
                this.staff.draw(); // 再描画
            } else {
                // カードコンテナからドラッグ中
                const cardElement = this.draggedCard.element;
                if (cardElement) {
                    cardElement.style.position = 'fixed';
                    cardElement.style.left = (clientX - this.dragOffset.x) + 'px';
                    cardElement.style.top = (clientY - this.dragOffset.y) + 'px';
                    cardElement.style.zIndex = '1000';
                }
            }
        };

        // ドロップ（マウスとタッチの両方に対応）
        const endDrag = (e) => {
            if (!this.draggedCard) return;

            const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
            const clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;

            const canvas = this.staff.canvas;
            const rect = canvas.getBoundingClientRect();
            const x = clientX - rect.left;
            const y = clientY - rect.top;

            // キャンバス内にドロップされたかチェック
            const isInCanvas = x >= 0 && x <= canvas.width && y >= 0 && y <= canvas.height;
            
            if (isInCanvas) {
                if (this.isDraggingFromCanvas && this.draggedCardData) {
                    // 相対オフセットを考慮して、カードの開始位置を計算
                    const cardStartX = x - this.dragOffset.x;
                    const cardStartEighth = Math.round((cardStartX - this.staff.leftMargin) / this.staff.eighthNoteWidth);
                    const eighthNote = Math.max(0, cardStartEighth);
                    
                    // 配置されたカードを移動
                    this.moveCardOnStaff(this.draggedCardData, eighthNote);
                } else {
                    // 新しいカードを配置（クリック位置から直接計算）
                    const eighthNote = this.staff.getEighthNoteFromPosition(clientX, clientY);
                    this.placeCardOnStaff(this.draggedCard, eighthNote);
                }
            } else if (this.isDraggingFromCanvas && this.draggedCardData) {
                // ピアノロールの範囲外にドロップされた場合、カードを元の位置に戻す
                this.returnCardToContainer(this.draggedCardData);
            }

            // ドラッグ状態をリセット
            const cardElement = this.draggedCard.element;
            if (cardElement) {
                cardElement.classList.remove('dragging');
                cardElement.style.position = '';
                cardElement.style.left = '';
                cardElement.style.top = '';
                cardElement.style.zIndex = '';
            }

            if (this.draggedCardData) {
                delete this.draggedCardData.tempPosition;
            }

            this.draggedCard = null;
            this.draggedCardData = null;
            this.isDraggingFromCanvas = false;
            e.preventDefault();
        };

        // イベントリスナーを設定
        cardsContainers.forEach(container => {
            container.addEventListener('mousedown', startDrag);
            container.addEventListener('touchstart', startDrag, { passive: false });
        });

        // キャンバス上でもドラッグ可能にする
        canvas.addEventListener('mousedown', startDrag);
        canvas.addEventListener('touchstart', startDrag, { passive: false });

        document.addEventListener('mousemove', drag);
        document.addEventListener('touchmove', drag, { passive: false });

        document.addEventListener('mouseup', endDrag);
        document.addEventListener('touchend', endDrag);
    }

    setupCardGeneration() {
        // カードが少なくなったら自動生成
        setInterval(() => {
            if (this.rhythmCards.filter(c => !c.isLocked).length < 2) {
                this.generateRhythmCard();
            }
            if (this.pitchCards.filter(c => !c.isLocked).length < 2) {
                this.generatePitchCard();
            }
        }, 5000);
    }

    generateRhythmCard() {
        const rhythmData = CardGenerator.generateRhythmCard();
        const card = new Card('rhythm', rhythmData, this.cardIdCounter++);
        this.rhythmCards.push(card);
        
        const container = document.getElementById('rhythm-cards-container');
        container.appendChild(card.createElement());
    }

    generatePitchCard() {
        const pitchData = CardGenerator.generatePitchCard();
        const card = new Card('pitch', pitchData, this.cardIdCounter++);
        this.pitchCards.push(card);
        
        const container = document.getElementById('pitch-cards-container');
        container.appendChild(card.createElement());
    }

    generateCards() {
        // リズムカードを3枚生成
        for (let i = 0; i < 3; i++) {
            const rhythmData = CardGenerator.generateRhythmCard();
            const card = new Card('rhythm', rhythmData, this.cardIdCounter++);
            this.rhythmCards.push(card);
            
            const container = document.getElementById('rhythm-cards-container');
            container.appendChild(card.createElement());
        }

        // 音程カードを3枚生成
        for (let i = 0; i < 3; i++) {
            const pitchData = CardGenerator.generatePitchCard();
            const card = new Card('pitch', pitchData, this.cardIdCounter++);
            this.pitchCards.push(card);
            
            const container = document.getElementById('pitch-cards-container');
            container.appendChild(card.createElement());
        }
    }

    findCardById(id) {
        return [...this.rhythmCards, ...this.pitchCards].find(c => c.id === id);
    }

    placeCardOnStaff(card, eighthNotePosition) {
        // カードを五線紙に配置
        this.staff.placeCard(card, eighthNotePosition);
        
        // 連鎖チェック（前のカードが待機状態の場合、位置を調整）
        this.checkChain();
        
        // 小節の完了をチェック
        this.checkMeasures();
        
        // 待機状態のカードをチェック
        this.staff.checkWaitingCards();
    }

    moveCardOnStaff(cardData, eighthNotePosition) {
        // 既存のカードを削除
        const index = this.staff.cards.indexOf(cardData);
        if (index === -1) return;
        
        this.staff.cards.splice(index, 1);
        
        // 新しい位置に配置
        if (cardData.combined) {
            const combinedData = {
                combined: true,
                rhythmCard: cardData.rhythmCard,
                pitchCard: cardData.pitchCard,
                position: {
                    eighthNote: eighthNotePosition
                }
            };
            this.staff.cards.push(combinedData);
            if (cardData.rhythmCard) cardData.rhythmCard.position = combinedData.position;
            if (cardData.pitchCard) cardData.pitchCard.position = combinedData.position;
        } else if (cardData.card) {
            const newCardData = {
                card: cardData.card,
                position: {
                    eighthNote: eighthNotePosition
                }
            };
            this.staff.cards.push(newCardData);
            cardData.card.position = newCardData.position;
        }
        
        this.staff.draw();
        
        // 連鎖チェック
        this.checkChain();
        
        // 小節の完了をチェック
        this.checkMeasures();
        
        // 待機状態のカードをチェック
        this.staff.checkWaitingCards();
    }

    returnCardToContainer(cardData) {
        // ロックされているカードは戻さない
        if (cardData.combined) {
            if ((cardData.rhythmCard && cardData.rhythmCard.isLocked) ||
                (cardData.pitchCard && cardData.pitchCard.isLocked)) {
                return;
            }
        } else if (cardData.card && cardData.card.isLocked) {
            return;
        }
        
        // ピアノロールからカードを削除
        const index = this.staff.cards.indexOf(cardData);
        if (index !== -1) {
            this.staff.cards.splice(index, 1);
        }
        
        // カードの状態をリセット
        if (cardData.combined) {
            // 組み合わせカードの場合、両方のカードをリセット
            if (cardData.rhythmCard) {
                cardData.rhythmCard.reset();
                // カード要素がDOMに存在しない場合は再追加
                if (cardData.rhythmCard.element && !cardData.rhythmCard.element.parentNode) {
                    const container = document.getElementById('rhythm-cards-container');
                    container.appendChild(cardData.rhythmCard.element);
                } else if (!cardData.rhythmCard.element) {
                    const container = document.getElementById('rhythm-cards-container');
                    container.appendChild(cardData.rhythmCard.createElement());
                }
            }
            if (cardData.pitchCard) {
                cardData.pitchCard.reset();
                // カード要素がDOMに存在しない場合は再追加
                if (cardData.pitchCard.element && !cardData.pitchCard.element.parentNode) {
                    const container = document.getElementById('pitch-cards-container');
                    container.appendChild(cardData.pitchCard.element);
                } else if (!cardData.pitchCard.element) {
                    const container = document.getElementById('pitch-cards-container');
                    container.appendChild(cardData.pitchCard.createElement());
                }
            }
        } else if (cardData.card) {
            cardData.card.reset();
            // カード要素がDOMに存在しない場合は再追加
            if (cardData.card.element && !cardData.card.element.parentNode) {
                const container = cardData.card.type === 'rhythm' 
                    ? document.getElementById('rhythm-cards-container')
                    : document.getElementById('pitch-cards-container');
                container.appendChild(cardData.card.element);
            } else if (!cardData.card.element) {
                const container = cardData.card.type === 'rhythm' 
                    ? document.getElementById('rhythm-cards-container')
                    : document.getElementById('pitch-cards-container');
                container.appendChild(cardData.card.createElement());
            }
        }
        
        // ピアノロールを再描画
        this.staff.draw();
        
        // 小節の完了を再チェック（カードが削除されたため）
        this.checkMeasures();
    }

    checkChain() {
        // 待機状態のカードがある場合、次のカードを連結して位置を調整
        const waitingCards = this.staff.cards.filter(cardData => {
            if (cardData.combined) {
                return (cardData.rhythmCard && cardData.rhythmCard.isWaiting) ||
                       (cardData.pitchCard && cardData.pitchCard.isWaiting);
            }
            return cardData.card && cardData.card.isWaiting;
        });

        if (waitingCards.length > 0) {
            // 最後の待機カードの位置を取得
            const lastWaiting = waitingCards[waitingCards.length - 1];
            const lastEnd = lastWaiting.position.eighthNote + 
                (lastWaiting.combined 
                    ? (lastWaiting.rhythmCard ? lastWaiting.rhythmCard.getLength() : 0)
                    : (lastWaiting.card ? lastWaiting.card.getLength() : 0));
            
            // 最新のカードが待機カードの直後に配置されているかチェック
            const latestCard = this.staff.cards[this.staff.cards.length - 1];
            if (latestCard && latestCard.position.eighthNote === lastEnd) {
                // 小節の区切りに合わせて位置を調整
                const measureIndex = Math.floor(lastEnd / this.staff.eighthNotesPerMeasure);
                const measureStart = measureIndex * this.staff.eighthNotesPerMeasure;
                const measureEnd = measureStart + this.staff.eighthNotesPerMeasure;
                
                // 小節が完全に埋まるように調整
                if (lastEnd < measureEnd) {
                    // 小節が完全に埋まったかチェック
                    this.checkMeasures();
                }
            }
        }
    }

    checkMeasures() {
        const completed = this.staff.getCompletedMeasures();
        let newMeasuresCompleted = false;
        
        completed.forEach(measureIndex => {
            if (!this.completedMeasures.has(measureIndex)) {
                this.completedMeasures.add(measureIndex);
                this.lockMeasureCards(measureIndex);
                this.updateScore(measureIndex);
                newMeasuresCompleted = true;
            }
        });

        // 新しい小節が確定されたら音を再生
        if (newMeasuresCompleted && !this.isPlayingMusic) {
            this.playMusic();
        }

        this.updateUI();
        this.checkChapterComplete();
    }

    lockMeasureCards(measureIndex) {
        const measureStart = measureIndex * this.staff.eighthNotesPerMeasure;
        const measureEnd = measureStart + this.staff.eighthNotesPerMeasure;

        this.staff.cards.forEach(cardData => {
            const start = cardData.position.eighthNote;
            const length = cardData.combined
                ? (cardData.rhythmCard ? cardData.rhythmCard.getLength() : 0)
                : (cardData.card ? cardData.card.getLength() : 0);
            const end = start + length;
            
            if (start >= measureStart && end <= measureEnd) {
                if (cardData.combined) {
                    // 組み合わせカードの場合
                    if (cardData.rhythmCard && !cardData.rhythmCard.isLocked) {
                        cardData.rhythmCard.lock();
                        if (!this.lockedCards.includes(cardData.rhythmCard)) {
                            this.lockedCards.push(cardData.rhythmCard);
                        }
                    }
                    if (cardData.pitchCard && !cardData.pitchCard.isLocked) {
                        cardData.pitchCard.lock();
                        if (!this.lockedCards.includes(cardData.pitchCard)) {
                            this.lockedCards.push(cardData.pitchCard);
                        }
                    }
                } else if (cardData.card && !cardData.card.isLocked) {
                    cardData.card.lock();
                    if (!this.lockedCards.includes(cardData.card)) {
                        this.lockedCards.push(cardData.card);
                    }
                }
            }
        });
    }

    updateScore(measureIndex) {
        // 小節ごとに基本スコア + 連鎖ボーナス
        const baseScore = 100;
        const chainBonus = this.completedMeasures.size * 10;
        const scoreGain = baseScore + chainBonus;
        
        this.score += scoreGain;
    }

    updateUI() {
        document.getElementById('score').textContent = this.score;
        document.getElementById('current-measures').textContent = this.completedMeasures.size;
        
        // 章に応じて目標スコアを更新
        const chapter = this.storyManager.currentChapter;
        this.targetScore = chapter === 1 ? 1000 : chapter === 2 ? 2000 : 3000;
        document.getElementById('target-score').textContent = this.targetScore;
        document.getElementById('chapter-number').textContent = chapter;
        
        const chapterTitles = {
            1: 'はじめてのメロディー',
            2: '森の賢王',
            3: 'お祭りのメロディー'
        };
        document.getElementById('chapter-title').textContent = chapterTitles[chapter] || '';
    }

    checkChapterComplete() {
        if (this.completedMeasures.size >= 16 && this.score >= this.targetScore) {
            this.completeChapter();
        }
    }

    completeChapter() {
        // 章クリア処理
        setTimeout(() => {
            alert(`第${this.storyManager.currentChapter}章をクリアしました！\nみんなで踊りましょう！`);
            
            if (this.storyManager.currentChapter < 3) {
                this.storyManager.advanceChapter();
                this.resetForNextChapter();
                this.showStory();
            } else {
                // エンディング
                alert('おめでとうございます！すべての章をクリアしました！\nみんなで完成したメロディーで踊って歌います！');
            }
        }, 500);
    }

    resetForNextChapter() {
        // 次の章のためにリセット
        this.completedMeasures.clear();
        this.lockedCards = [];
        this.score = 0;
        this.clearStaff();
        this.generateCards();
    }

    clearStaff() {
        // すべてのカードをリセット
        this.staff.cards.forEach(cardData => {
            if (cardData.combined) {
                if (cardData.rhythmCard) cardData.rhythmCard.reset();
                if (cardData.pitchCard) cardData.pitchCard.reset();
            } else if (cardData.card) {
                cardData.card.reset();
            }
        });
        this.staff.cards = [];
        this.completedMeasures.clear();
        this.lockedCards = [];
        this.staff.draw();
        this.updateUI();
    }

    playMusic() {
        // オーディオコンテキストを再開（必要に応じて）
        if (this.audioManager.audioContext && this.audioManager.audioContext.state === 'suspended') {
            this.audioManager.audioContext.resume();
        }

        // 確定された小節の音をループ再生
        const completedMeasures = Array.from(this.completedMeasures).sort((a, b) => a - b);
        
        if (completedMeasures.length === 0) {
            return;
        }

        // テンポ（BPM）
        const tempo = 120;
        const beatDuration = 60 / tempo; // 4分音符の長さ（秒）
        const eighthNoteDuration = beatDuration / 2; // 8分音符の長さ

        // 各小節のメロディーを構築
        const allMelodies = [];
        completedMeasures.forEach(measureIndex => {
            const measureStart = measureIndex * this.staff.eighthNotesPerMeasure;
            
            // この小節内のカードを取得
            const measureCards = this.staff.cards.filter(cardData => {
                const start = cardData.position.eighthNote;
                const length = cardData.combined
                    ? (cardData.rhythmCard ? cardData.rhythmCard.getLength() : 0)
                    : (cardData.card ? cardData.card.getLength() : 0);
                const end = start + length;
                return start >= measureStart && start < measureStart + this.staff.eighthNotesPerMeasure;
            });

            // 組み合わせカードからメロディーを構築
            measureCards.forEach(cardData => {
                if (cardData.combined && cardData.rhythmCard && cardData.pitchCard) {
                    const rhythm = cardData.rhythmCard.data;
                    const pitches = cardData.pitchCard.data;
                    const cardStartEighth = cardData.position.eighthNote - measureStart;
                    
                    let timeOffset = 0;
                    rhythm.forEach((duration, index) => {
                        if (index < pitches.length) {
                            const noteDuration = duration * eighthNoteDuration;
                            allMelodies.push({
                                note: pitches[index],
                                duration: noteDuration,
                                start: (measureIndex * this.staff.eighthNotesPerMeasure + cardStartEighth + timeOffset) * eighthNoteDuration
                            });
                            timeOffset += duration;
                        }
                    });
                } else if (cardData.card && cardData.card.type === 'pitch' && cardData.card.data) {
                    // 単独の音程カード
                    const cardStartEighth = cardData.position.eighthNote - measureStart;
                    cardData.card.data.forEach((note, index) => {
                        allMelodies.push({
                            note: note,
                            duration: 2 * eighthNoteDuration, // デフォルトで2（8分音符）
                            start: (measureIndex * this.staff.eighthNotesPerMeasure + cardStartEighth + index * 2) * eighthNoteDuration
                        });
                    });
                }
            });
        });

        // メロディーを時間順にソート
        allMelodies.sort((a, b) => a.start - b.start);

        // ループ再生
        const loopDuration = this.staff.eighthNotesPerMeasure * completedMeasures.length * eighthNoteDuration;
        
        const playLoop = () => {
            if (!this.isPlayingMusic) return;
            
            const baseTime = this.audioManager.audioContext.currentTime;
            allMelodies.forEach(melody => {
                this.audioManager.playNote(melody.note, melody.duration, baseTime + melody.start, 0.2);
            });
            
            setTimeout(playLoop, loopDuration * 1000);
        };

        this.isPlayingMusic = true;
        playLoop();
    }

    stopMusic() {
        this.isPlayingMusic = false;
        this.audioManager.stopAll();
    }

    showStory() {
        const overlay = document.getElementById('story-overlay');
        const title = document.getElementById('story-title');
        const text = document.getElementById('story-text');
        const nextBtn = document.getElementById('story-next-btn');
        
        this.storyManager.showStory(overlay, title, text, nextBtn);
    }

    gameLoop() {
        // 定期的に小節の状態をチェック
        this.checkMeasures();
        
        // 60FPSでループ
        setTimeout(() => this.gameLoop(), 1000 / 60);
    }
}

// ゲームを開始
window.addEventListener('DOMContentLoaded', () => {
    const game = new Game();
    window.game = game; // デバッグ用
});

