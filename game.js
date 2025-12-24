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
        this.currentPlayPosition = 0; // 現在の再生位置（8分音符単位）
        this.playPositionInterval = null; // 再生ポジション更新用のインターバル
        this.playStartTime = null; // 再生開始時刻
        this.scheduledTimeouts = []; // スケジュールされたタイマーを追跡
        this.isCompletingChapter = false; // 章クリア処理中かどうか
        this.scrollFollowInterval = null; // スクロール追従用のインターバル
        this.isPreviewingCard = false; // カードプレビュー中かどうか
        this.previewStateTimer = null; // プレビュー状態解除用タイマー
        this.previewingCardId = null; // 現在プレビュー中のカードID
        
        this.init();
    }

    init() {
        // オーディオマネージャーを初期化
        this.audioManager.init();

        // キャンバスを取得
        const canvas = document.getElementById('staff-canvas');
        this.staff = new Staff(canvas, { numerator: 4, denominator: 4 }, this);

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
        document.getElementById('submit-btn').addEventListener('click', () => this.submitChapter());
        document.getElementById('export-wav-btn').addEventListener('click', () => this.exportWAV());

        // BPM入力フィールドの変更を監視
        const bpmInput = document.getElementById('bpm-input');
        if (bpmInput) {
            bpmInput.addEventListener('input', () => {
                // 再生中の場合、新しいBPMで再開
                if (this.isPlayingMusic) {
                    this.playMusic();
                }
            });
        }

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
            // ロックされていないカードの数をチェック
            const availableRhythmCards = this.rhythmCards.filter(c => !c.isLocked && c.element && c.element.parentNode);
            const availablePitchCards = this.pitchCards.filter(c => !c.isLocked && c.element && c.element.parentNode);
            
            // カードが完全に無くなった場合は補充
            if (availableRhythmCards.length === 0) {
                this.generateRhythmCard();
            } else if (availableRhythmCards.length < 2) {
                this.generateRhythmCard();
            }
            
            if (availablePitchCards.length === 0) {
                this.generatePitchCard();
            } else if (availablePitchCards.length < 2) {
                this.generatePitchCard();
            }
        }, 5000);
    }

    generateRhythmCard() {
        const rhythmData = CardGenerator.generateRhythmCard();
        const card = new Card('rhythm', rhythmData, this.cardIdCounter++);
        this.rhythmCards.push(card);
        
        const container = document.getElementById('rhythm-cards-container');
        const element = card.createElement();
        container.appendChild(element);
        
        // マウスオーバーでリズムをプレビュー再生
        this.setupCardPreview(card, element);
    }

    generatePitchCard() {
        const pitchData = CardGenerator.generatePitchCard();
        const card = new Card('pitch', pitchData, this.cardIdCounter++);
        this.pitchCards.push(card);
        
        const container = document.getElementById('pitch-cards-container');
        const element = card.createElement();
        container.appendChild(element);
        
        // マウスオーバーで音程をプレビュー再生
        this.setupCardPreview(card, element);
    }

    // カードのプレビュー再生を設定
    setupCardPreview(card, element) {
        let previewTimeout = null;
        
        element.addEventListener('mouseenter', () => {
            // ロック中または再生中なら何もしない
            if (card.isLocked || this.isPlayingMusic) return;
            
            // 同じカードのプレビューが既に開始されている場合は何もしない
            if (this.isPreviewingCard && this.previewingCardId === card.id) return;
            
            // 異なるカードのプレビューが開始されている場合は、前のプレビューを停止
            if (this.isPreviewingCard && this.previewingCardId !== card.id) {
                this.stopPreview();
            }
            
            // 少し遅延してから再生（誤操作を防ぐ）
            previewTimeout = setTimeout(() => {
                // 再生中になったら中止
                if (this.isPlayingMusic) return;
                
                // 既に別のカードのプレビューが開始されていたら中止（同じカードの場合は継続）
                if (this.isPreviewingCard && this.previewingCardId !== card.id) return;
                
                this.isPreviewingCard = true;
                this.previewingCardId = card.id;
                
                // 既存のプレビュー状態解除タイマーをクリア
                if (this.previewStateTimer) {
                    clearTimeout(this.previewStateTimer);
                    this.previewStateTimer = null;
                }

                let durationSec = 0;
                if (card.type === 'pitch') {
                    durationSec = this.previewPitchCard(card);
                } else if (card.type === 'rhythm') {
                    durationSec = this.previewRhythmCard(card);
                }

                // プレビュー終了後に新しいプレビューを許可
                if (durationSec > 0) {
                    this.previewStateTimer = setTimeout(() => {
                        this.isPreviewingCard = false;
                        this.previewingCardId = null;
                        this.previewStateTimer = null;
                    }, durationSec * 1000 + 50);
                } else {
                    // 何も再生されなかった場合はすぐに解除
                    this.isPreviewingCard = false;
                    this.previewingCardId = null;
                }
            }, 300); // 300ms後に再生
        });
        
        element.addEventListener('mouseleave', () => {
            if (previewTimeout) {
                clearTimeout(previewTimeout);
                previewTimeout = null;
            }
        });
    }

    // 音程カードのプレビュー再生
    previewPitchCard(card) {
        if (!this.audioManager.audioContext) {
            this.audioManager.init();
        }
        if (this.audioManager.audioContext && this.audioManager.audioContext.state === 'suspended') {
            this.audioManager.audioContext.resume();
        }
        
        const tempo = parseInt(document.getElementById('bpm-input').value) || 300;
        const beatDuration = 60 / tempo;
        const eighthNoteDuration = beatDuration / 2;
        
        const now = this.audioManager.audioContext.currentTime;
        card.data.forEach((note, index) => {
            const startTime = now + index * eighthNoteDuration;
            this.audioManager.playNoteAbsolute(note, eighthNoteDuration, startTime, 0.2);
        });

        // 全体のプレビュー長さ（秒）を返す
        return card.data.length * eighthNoteDuration;
    }

    // リズムカードのプレビュー再生
    previewRhythmCard(card) {
        if (!this.audioManager.audioContext) {
            this.audioManager.init();
        }
        if (this.audioManager.audioContext && this.audioManager.audioContext.state === 'suspended') {
            this.audioManager.audioContext.resume();
        }
        
        // リズムプレビューは早いテンポで再生（BPMの2倍）
        const baseTempo = parseInt(document.getElementById('bpm-input').value) || 300;
        const tempo = baseTempo * 2; // 2倍速
        const beatDuration = 60 / tempo;
        const eighthNoteDuration = beatDuration / 2;
        
        const now = this.audioManager.audioContext.currentTime;
        
        let timeOffset = 0;
        let totalDuration = 0;
        card.data.forEach((duration) => {
            const noteDuration = duration * eighthNoteDuration;
            const startTime = now + timeOffset;
            // ノイズ音で再生
            this.audioManager.playNoiseAbsolute(noteDuration, startTime, 0.2);
            timeOffset += noteDuration;
            totalDuration += noteDuration;
        });

        // 全体のプレビュー長さ（秒）を返す
        return totalDuration;
    }

    // プレビュー再生を停止
    stopPreview() {
        // プレビュー中の音を停止
        this.audioManager.stopAll();
        
        // プレビュー状態をリセット
        this.isPreviewingCard = false;
        this.previewingCardId = null;
        
        // プレビュー状態解除タイマーをクリア
        if (this.previewStateTimer) {
            clearTimeout(this.previewStateTimer);
            this.previewStateTimer = null;
        }
    }

    generateCards() {
        // リズムカードを3枚生成
        for (let i = 0; i < 3; i++) {
            const rhythmData = CardGenerator.generateRhythmCard();
            const card = new Card('rhythm', rhythmData, this.cardIdCounter++);
            this.rhythmCards.push(card);
            
            const container = document.getElementById('rhythm-cards-container');
            const element = card.createElement();
            container.appendChild(element);
            
            // マウスオーバーでリズムをプレビュー再生
            this.setupCardPreview(card, element);
        }

        // 音程カードを3枚生成
        for (let i = 0; i < 3; i++) {
            const pitchData = CardGenerator.generatePitchCard();
            const card = new Card('pitch', pitchData, this.cardIdCounter++);
            this.pitchCards.push(card);
            
            const container = document.getElementById('pitch-cards-container');
            const element = card.createElement();
            container.appendChild(element);
            
            // マウスオーバーで音程をプレビュー再生
            this.setupCardPreview(card, element);
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
        
        // 再生中の場合、新しいカード構成で再開
        if (this.isPlayingMusic) {
            this.playMusic();
        }
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
        
        // 再生中の場合、新しいカード構成で再開
        if (this.isPlayingMusic) {
            this.playMusic();
        }
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
        
        // 再生中の場合、新しいカード構成で再開
        if (this.isPlayingMusic) {
            this.playMusic();
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

    // カード合成時のスコア加算
    addScoreForCombination() {
        this.score += 50;
        this.updateUI();
    }

    // 再生可能な範囲から小節数を計算
    getPlayableMeasuresCount() {
        // 配置されているすべてのカードからメロディーを構築
        const allCards = this.staff.cards.filter(cardData => {
            // 組み合わせカードまたは音程カードのみ
            if (cardData.combined) {
                return cardData.rhythmCard && cardData.pitchCard;
            } else if (cardData.card) {
                return cardData.card.type === 'pitch' && cardData.card.data;
            }
            return false;
        });

        if (allCards.length === 0) {
            return 0;
        }

        // すべてのカードからメロディーを構築（8分音符単位で）
        const notes = [];
        
        allCards.forEach(cardData => {
            if (cardData.combined && cardData.rhythmCard && cardData.pitchCard) {
                const rhythm = cardData.rhythmCard.data;
                const pitches = cardData.pitchCard.data;
                const cardStartEighth = cardData.position.eighthNote;
                
                let eighthOffset = 0;
                rhythm.forEach((duration, index) => {
                    if (index < pitches.length) {
                        notes.push({
                            eighthNote: cardStartEighth + eighthOffset,
                            note: pitches[index],
                            duration: duration
                        });
                        eighthOffset += duration;
                    }
                });
            } else if (cardData.card && cardData.card.type === 'pitch' && cardData.card.data) {
                const cardStartEighth = cardData.position.eighthNote;
                cardData.card.data.forEach((note, index) => {
                    notes.push({
                        eighthNote: cardStartEighth + index,
                        note: note,
                        duration: 1
                    });
                });
            }
        });

        if (notes.length === 0) {
            return 0;
        }

        notes.sort((a, b) => a.eighthNote - b.eighthNote);

        const firstEighthNote = notes[0].eighthNote;
        const lastNote = notes[notes.length - 1];
        const lastEighthNote = lastNote.eighthNote + lastNote.duration;

        // 最初と最後の8分音符位置から小節数を計算
        // 小節番号は0から始まるので、+1する必要がある
        const firstMeasure = Math.floor(firstEighthNote / this.staff.eighthNotesPerMeasure);
        const lastMeasure = Math.floor((lastEighthNote - 1) / this.staff.eighthNotesPerMeasure);
        
        // 小節数 = 最後の小節番号 - 最初の小節番号 + 1
        return Math.max(0, lastMeasure - firstMeasure + 1);
    }

    // 章ごとの目標小節数を取得
    getTargetMeasures() {
        const chapter = this.storyManager.currentChapter;
        return chapter === 1 ? 1 : chapter === 2 ? 4 : 16;
    }

    updateUI() {
        document.getElementById('score').textContent = this.score;
        
        // 再生可能な範囲から小節数を計算
        const playableMeasures = this.getPlayableMeasuresCount();
        document.getElementById('current-measures').textContent = playableMeasures;
        
        // 章に応じて目標スコアと目標小節数を更新
        const chapter = this.storyManager.currentChapter;
        this.targetScore = chapter === 1 ? 100 : chapter === 2 ? 200 : 300;
        const targetMeasures = this.getTargetMeasures();
        document.getElementById('target-score').textContent = this.targetScore;
        document.getElementById('target-measures').textContent = targetMeasures;
        document.getElementById('chapter-number').textContent = chapter;
        
        const chapterTitles = {
            1: 'はじめてのメロディー',
            2: '森の賢王',
            3: 'お祭りのメロディー'
        };
        document.getElementById('chapter-title').textContent = chapterTitles[chapter] || '';
    }

    checkChapterComplete() {
        // 既に章クリア処理中の場合はスキップ
        if (this.isCompletingChapter) {
            return;
        }
        
        const targetMeasures = this.getTargetMeasures();
        const playableMeasures = this.getPlayableMeasuresCount();
        
        if (playableMeasures >= targetMeasures && this.score >= this.targetScore) {
            this.completeChapter();
        }
    }

    completeChapter() {
        // 既に章クリア処理中の場合はスキップ
        if (this.isCompletingChapter) {
            return;
        }
        
        // 章クリア処理中フラグを設定
        this.isCompletingChapter = true;
        
        // 章クリア処理
        setTimeout(() => {
            const currentChapter = this.storyManager.currentChapter;
            alert(`第${currentChapter}章をクリアしました！\nみんなで踊りましょう！`);
            
            // 再生カーソルに合わせてスクロール
            this.startScrollFollow();
            
            if (currentChapter < 3) {
                // 1ループのみメロディーを再生し、終了後に次の章へ
                this.playMusic(true, () => {
                    this.stopScrollFollow();
                    this.storyManager.advanceChapter();
                    this.resetForNextChapter();
                    this.showStory();
                });
            } else {
                // エンディング：1ループのみメロディーを再生し、終了後にタイトルに戻る
                this.playMusic(true, () => {
                    this.stopScrollFollow();
                    alert('おめでとうございます！すべての章をクリアしました！\nみんなで完成したメロディーで踊って歌います！');
                    this.returnToTitle();
                });
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
        
        // スクロール位置を先頭に戻す
        this.scrollToStart();
        
        // 章クリア処理中フラグをリセット（次の章の準備ができたので）
        this.isCompletingChapter = false;
    }

    // スクロール位置を先頭に戻す
    scrollToStart() {
        const canvas = this.staff.canvas;
        const container = canvas.parentElement;
        if (container) {
            container.scrollLeft = 0;
        }
        // ウィンドウ全体のスクロールもリセット
        window.scrollTo(0, 0);
    }

    // 再生カーソルに合わせてスクロールを開始
    startScrollFollow() {
        // 既存のインターバルをクリア
        if (this.scrollFollowInterval) {
            clearInterval(this.scrollFollowInterval);
        }
        
        const canvas = this.staff.canvas;
        const container = canvas.parentElement;
        
        this.scrollFollowInterval = setInterval(() => {
            if (!this.isPlayingMusic || !this.currentPlayPosition) {
                return;
            }
            
            // 現在の再生位置からX座標を計算
            const x = this.staff.leftMargin + this.currentPlayPosition * this.staff.eighthNoteWidth;
            
            // コンテナの幅を取得
            const containerWidth = container ? container.clientWidth : window.innerWidth;
            
            // スクロール位置を計算（カーソルが中央に来るように）
            const scrollX = x - containerWidth / 2;
            
            // スクロール
            if (container) {
                container.scrollLeft = Math.max(0, scrollX);
            } else {
                window.scrollTo(Math.max(0, scrollX), window.scrollY);
            }
        }, 16); // 約60FPS
    }

    // スクロール追従を停止
    stopScrollFollow() {
        if (this.scrollFollowInterval) {
            clearInterval(this.scrollFollowInterval);
            this.scrollFollowInterval = null;
        }
    }

    // タイトルに戻る
    returnToTitle() {
        // ゲーム状態をリセット
        this.stopMusic();
        this.stopScrollFollow();
        this.isCompletingChapter = false;
        this.completedMeasures.clear();
        this.lockedCards = [];
        this.score = 0;
        this.clearStaff();
        
        // ストーリーマネージャーをリセット
        this.storyManager.currentChapter = 1;
        this.storyManager.currentStoryIndex = 0;
        
        // カードを再生成
        this.generateCards();
        
        // スクロール位置を先頭に戻す
        this.scrollToStart();
        
        // ストーリーを表示（タイトル画面）
        this.showStory();
        
        // UIを更新
        this.updateUI();
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
        
        // 再生中の場合、停止（カードがなくなったため）
        if (this.isPlayingMusic) {
            this.stopMusic();
        }
        
        this.updateUI();
    }

    playMusic(singleLoop = false, onComplete = null) {
        // 既に再生中の場合は停止（完全に停止するまで待つ）
        if (this.isPlayingMusic) {
            this.stopMusic();
            // 停止処理が完了するまで少し待機（タイマーとオシレーターの停止を確実にする）
            // 同期的に停止処理が完了するため、即座に続行可能
        }

        // オーディオコンテキストを初期化（必要に応じて）
        if (!this.audioManager.audioContext) {
            this.audioManager.init();
        }

        // オーディオコンテキストを再開（必要に応じて）
        if (this.audioManager.audioContext && this.audioManager.audioContext.state === 'suspended') {
            this.audioManager.audioContext.resume();
        }

        // 配置されているすべてのカードからメロディーを構築
        const allCards = this.staff.cards.filter(cardData => {
            // 組み合わせカードまたは音程カードのみ
            if (cardData.combined) {
                return cardData.rhythmCard && cardData.pitchCard;
            } else if (cardData.card) {
                return cardData.card.type === 'pitch' && cardData.card.data;
            }
            return false;
        });

        if (allCards.length === 0) {
            console.log('再生するカードがありません');
            return;
        }

        // BPMを入力欄から取得
        const bpmInput = document.getElementById('bpm-input');
        const tempo = parseInt(bpmInput.value) || 120;
        const beatDuration = 60 / tempo; // 4分音符の長さ（秒）
        const eighthNoteDuration = beatDuration / 2; // 8分音符の長さ

        // すべてのカードからメロディーを構築（8分音符単位で）
        const notes = []; // { eighthNote, note, duration }
        
        allCards.forEach(cardData => {
            if (cardData.combined && cardData.rhythmCard && cardData.pitchCard) {
                const rhythm = cardData.rhythmCard.data;
                const pitches = cardData.pitchCard.data;
                const cardStartEighth = cardData.position.eighthNote;
                
                let eighthOffset = 0;
                rhythm.forEach((duration, index) => {
                    if (index < pitches.length) {
                        notes.push({
                            eighthNote: cardStartEighth + eighthOffset,
                            note: pitches[index],
                            duration: duration // 8分音符単位
                        });
                        eighthOffset += duration;
                    }
                });
            } else if (cardData.card && cardData.card.type === 'pitch' && cardData.card.data) {
                // 単独の音程カード（デフォルトで1ブロック=1八分音符）
                const cardStartEighth = cardData.position.eighthNote;
                cardData.card.data.forEach((note, index) => {
                    notes.push({
                        eighthNote: cardStartEighth + index,
                        note: note,
                        duration: 1 // 1八分音符
                    });
                });
            }
        });

        if (notes.length === 0) {
            console.log('再生するメロディーがありません');
            return;
        }

        // 8分音符位置でソート
        notes.sort((a, b) => a.eighthNote - b.eighthNote);

        // 最初と最後の8分音符位置を取得
        const firstEighthNote = notes[0].eighthNote;
        const lastNote = notes[notes.length - 1];
        const lastEighthNote = lastNote.eighthNote + lastNote.duration;
        const totalEighthNotes = lastEighthNote - firstEighthNote;

        // ループ再生の長さ（最後のノートの終了位置まで）
        const loopDuration = totalEighthNotes * eighthNoteDuration;
        
        // ループ時間が異常な値でないかチェック
        if (loopDuration <= 0 || loopDuration > 60) {
            console.error('異常なループ時間:', loopDuration, 'totalEighthNotes:', totalEighthNotes, 'eighthNoteDuration:', eighthNoteDuration);
            return;
        }

        // 再生位置を先頭にリセット
        this.currentPlayPosition = firstEighthNote;
        this.playStartTime = null;
        this.loopDuration = loopDuration;
        this.firstEighthNote = firstEighthNote;
        this.lastEighthNote = lastEighthNote;
        this.eighthNoteDuration = eighthNoteDuration;
        this.notes = notes;

        // 再生関数（絶対時刻でスケジュール）
        const scheduleNotes = (baseTime) => {
            notes.forEach(noteData => {
                // ノートが有効かチェック
                if (!noteData.note) {
                    console.warn('無効なノートデータ:', noteData);
                    return;
                }
                
                const relativeEighth = noteData.eighthNote - firstEighthNote;
                const absoluteStartTime = baseTime + relativeEighth * eighthNoteDuration;
                const noteDuration = noteData.duration * eighthNoteDuration;
                
                // 絶対時刻を直接渡す（相対時刻ではない）
                this.audioManager.playNoteAbsolute(noteData.note, noteDuration, absoluteStartTime, 0.2);
            });
        };

        // 再生開始時刻を即座に設定
        const now = this.audioManager.audioContext.currentTime;
        const startTime = now + 0.01; // 0.01秒後（最小限の遅延）
        this.playStartTime = startTime;
        
        // 最初の再生をスケジュール
        scheduleNotes(startTime);
        
        // 再生ポジション更新用のインターバルを開始（音の再生と同期）
        this.startPlayPositionUpdate();

        this.isPlayingMusic = true;
        // 初期描画（再生ポジションを最初のメロディーの位置で）
        this.staff.draw(firstEighthNote);
        
        // ループ再生を正確なタイミングでスケジュール
        const scheduleNextLoop = () => {
            if (!this.isPlayingMusic) return;
            
            // 1ループのみ再生の場合は、ループをスケジュールしない
            if (singleLoop) {
                // 1ループ終了後に停止
                setTimeout(() => {
                    if (this.isPlayingMusic) {
                        this.stopMusic();
                        if (onComplete) {
                            onComplete();
                        }
                    }
                }, loopDuration * 1000);
                return;
            }
            
            const currentTime = this.audioManager.audioContext.currentTime;
            
            // 最初のループ開始時刻を基準に、次のループ開始時刻を計算
            if (!this.playStartTime) {
                this.playStartTime = startTime;
            }
            
            // 経過時間から、次のループ開始時刻を計算
            const elapsed = currentTime - this.playStartTime;
            const loopsElapsed = Math.floor(elapsed / loopDuration);
            const nextLoopStart = this.playStartTime + (loopsElapsed + 1) * loopDuration;
            
            // 次のループまでの時間を計算（ミリ秒）
            const timeUntilNext = (nextLoopStart - currentTime) * 1000;
            
            if (timeUntilNext > 10 && timeUntilNext < loopDuration * 1000 + 1000) {
                // 次のループをスケジュール（10ms以上の余裕がある場合、かつループ時間+1秒以内）
                const timeoutId = setTimeout(() => {
                    if (!this.isPlayingMusic) return;
                    
                    // タイマーIDを削除
                    const index = this.scheduledTimeouts.indexOf(timeoutId);
                    if (index > -1) {
                        this.scheduledTimeouts.splice(index, 1);
                    }
                    
                    // 次のループをスケジュール
                    scheduleNotes(nextLoopStart);
                    
                    // 再生位置を先頭にリセット（playStartTimeは最初の開始時刻のまま）
                    this.currentPlayPosition = firstEighthNote;
                    
                    // さらに次のループをスケジュール
                    scheduleNextLoop();
                }, timeUntilNext);
                this.scheduledTimeouts.push(timeoutId);
            } else if (timeUntilNext <= 10 && timeUntilNext >= -loopDuration * 1000) {
                // 時間が過ぎているか、すぐに実行する必要がある場合
                // 次のループを即座にスケジュール
                scheduleNotes(nextLoopStart);
                this.currentPlayPosition = firstEighthNote;
                
                // さらに次のループをスケジュール（少し遅延を入れて無限ループを防ぐ）
                const timeoutId = setTimeout(() => {
                    if (this.isPlayingMusic) {
                        const index = this.scheduledTimeouts.indexOf(timeoutId);
                        if (index > -1) {
                            this.scheduledTimeouts.splice(index, 1);
                        }
                        scheduleNextLoop();
                    }
                }, 10);
                this.scheduledTimeouts.push(timeoutId);
            } else {
                // 異常な値の場合は停止
                console.error('異常なループ時間:', {
                    timeUntilNext,
                    currentTime,
                    playStartTime: this.playStartTime,
                    loopDuration,
                    nextLoopStart,
                    elapsed
                });
                this.stopMusic();
            }
        };
        
        // 最初のループ終了後に次のループをスケジュール（1ループのみの場合はスケジュールしない）
        if (!singleLoop) {
            const firstTimeoutId = setTimeout(() => {
                if (this.isPlayingMusic) {
                    const index = this.scheduledTimeouts.indexOf(firstTimeoutId);
                    if (index > -1) {
                        this.scheduledTimeouts.splice(index, 1);
                    }
                    scheduleNextLoop();
                }
            }, loopDuration * 1000);
            this.scheduledTimeouts.push(firstTimeoutId);
        } else {
            // 1ループのみの場合は、1ループ終了後に停止
            const singleLoopTimeoutId = setTimeout(() => {
                if (this.isPlayingMusic) {
                    const index = this.scheduledTimeouts.indexOf(singleLoopTimeoutId);
                    if (index > -1) {
                        this.scheduledTimeouts.splice(index, 1);
                    }
                    this.stopMusic();
                    if (onComplete) {
                        onComplete();
                    }
                }
            }, loopDuration * 1000);
            this.scheduledTimeouts.push(singleLoopTimeoutId);
        }
    }

    // 再生ポジション更新を開始（音の再生と同期）
    startPlayPositionUpdate() {
        // 既存のインターバルをクリア
        if (this.playPositionInterval) {
            clearInterval(this.playPositionInterval);
        }
        
        // 再生ポジションを更新（音の再生タイミングと完全に同期）
        const updatePosition = () => {
            if (!this.isPlayingMusic || !this.playStartTime) return;
            
            const currentTime = this.audioManager.audioContext.currentTime;
            const elapsed = currentTime - this.playStartTime;
            
            // ループ内の位置を計算
            const loopElapsed = elapsed % this.loopDuration;
            const eighthNotesElapsed = Math.floor(loopElapsed / this.eighthNoteDuration);
            const currentPosition = this.firstEighthNote + eighthNotesElapsed;
            
            // 最後の位置を超えた場合は先頭に戻す
            if (currentPosition >= this.lastEighthNote) {
                this.currentPlayPosition = this.firstEighthNote;
            } else {
                this.currentPlayPosition = currentPosition;
            }
            
            // 再生ポジションをハイライトするために再描画
            this.staff.draw(this.currentPlayPosition);
        };
        
        // 高頻度で更新（60FPS）
        this.playPositionInterval = setInterval(updatePosition, 16); // 約60FPS
    }

    stopMusic() {
        // 即座に停止フラグを設定
        this.isPlayingMusic = false;
        
        // スケジュールされたすべてのタイマーをキャンセル
        this.scheduledTimeouts.forEach(timeoutId => {
            clearTimeout(timeoutId);
        });
        this.scheduledTimeouts = [];
        
        // 再生ポジション更新インターバルを即座にクリア
        if (this.playPositionInterval) {
            clearInterval(this.playPositionInterval);
            this.playPositionInterval = null;
        }
        
        // 音を停止
        this.audioManager.stopAll();
        
        // 再生位置をリセット
        this.currentPlayPosition = 0;
        this.playStartTime = null;
        
        // 再生ポジションのハイライトをクリア
        this.staff.draw(null);
        
        // スクロール追従を停止
        this.stopScrollFollow();
    }

    // 章を提出（終了）
    submitChapter() {
        const targetMeasures = this.getTargetMeasures();
        const playableMeasures = this.getPlayableMeasuresCount();
        
        if (playableMeasures >= targetMeasures && this.score >= this.targetScore) {
            this.completeChapter();
        } else {
            const missingMeasures = Math.max(0, targetMeasures - playableMeasures);
            const missingScore = Math.max(0, this.targetScore - this.score);
            alert(`提出条件を満たしていません。\n残り小節: ${missingMeasures}小節\n不足スコア: ${missingScore}点`);
        }
    }

    // WAVファイルを出力（2ループ分）
    async exportWAV() {
        // 配置されているすべてのカードからメロディーを構築
        const allCards = this.staff.cards.filter(cardData => {
            if (cardData.combined) {
                return cardData.rhythmCard && cardData.pitchCard;
            } else if (cardData.card) {
                return cardData.card.type === 'pitch' && cardData.card.data;
            }
            return false;
        });

        if (allCards.length === 0) {
            alert('出力するメロディーがありません。');
            return;
        }

        // BPMを入力欄から取得
        const bpmInput = document.getElementById('bpm-input');
        const tempo = parseInt(bpmInput.value) || 120;
        const beatDuration = 60 / tempo;
        const eighthNoteDuration = beatDuration / 2;

        // すべてのカードからメロディーを構築
        const notes = [];
        allCards.forEach(cardData => {
            if (cardData.combined && cardData.rhythmCard && cardData.pitchCard) {
                const rhythm = cardData.rhythmCard.data;
                const pitches = cardData.pitchCard.data;
                const cardStartEighth = cardData.position.eighthNote;
                
                let eighthOffset = 0;
                rhythm.forEach((duration, index) => {
                    if (index < pitches.length) {
                        notes.push({
                            eighthNote: cardStartEighth + eighthOffset,
                            note: pitches[index],
                            duration: duration
                        });
                        eighthOffset += duration;
                    }
                });
            } else if (cardData.card && cardData.card.type === 'pitch' && cardData.card.data) {
                const cardStartEighth = cardData.position.eighthNote;
                cardData.card.data.forEach((note, index) => {
                    notes.push({
                        eighthNote: cardStartEighth + index,
                        note: note,
                        duration: 1
                    });
                });
            }
        });

        if (notes.length === 0) {
            alert('出力するメロディーがありません。');
            return;
        }

        notes.sort((a, b) => a.eighthNote - b.eighthNote);

        const firstEighthNote = notes[0].eighthNote;
        const lastNote = notes[notes.length - 1];
        const lastEighthNote = lastNote.eighthNote + lastNote.duration;
        const totalEighthNotes = lastEighthNote - firstEighthNote;

        // 2ループ分の長さを計算
        const loopDuration = totalEighthNotes * eighthNoteDuration;
        const totalDuration = loopDuration * 2;

        // サンプルレート
        const sampleRate = 44100;
        const frameCount = Math.ceil(totalDuration * sampleRate);

        // OfflineAudioContextを作成
        const offlineContext = new OfflineAudioContext(1, frameCount, sampleRate);

        // 2ループ分のノートをスケジュール
        for (let loop = 0; loop < 2; loop++) {
            const loopStartTime = loop * loopDuration;
            notes.forEach(noteData => {
                const relativeEighth = noteData.eighthNote - firstEighthNote;
                const absoluteStartTime = loopStartTime + relativeEighth * eighthNoteDuration;
                const noteDuration = noteData.duration * eighthNoteDuration;
                
                this.audioManager.playNoteOffline(
                    offlineContext,
                    noteData.note,
                    noteDuration,
                    absoluteStartTime,
                    0.3
                );
            });
        }

        try {
            // オーディオをレンダリング
            const audioBuffer = await offlineContext.startRendering();
            
            // WAVファイルに変換
            const wavData = this.audioBufferToWav(audioBuffer);
            
            // ファイル名を生成（音名の組み合わせ）
            const fileName = this.generateFileName(notes);
            
            // ダウンロード
            this.downloadWAV(wavData, fileName);
        } catch (error) {
            console.error('WAV出力エラー:', error);
            alert('WAVファイルの出力に失敗しました。');
        }
    }

    // AudioBufferをWAV形式に変換
    audioBufferToWav(buffer) {
        const length = buffer.length;
        const sampleRate = buffer.sampleRate;
        const arrayBuffer = new ArrayBuffer(44 + length * 2);
        const view = new DataView(arrayBuffer);
        const channels = buffer.numberOfChannels;
        const data = buffer.getChannelData(0);

        // WAVヘッダー
        const writeString = (offset, string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };

        writeString(0, 'RIFF');
        view.setUint32(4, 36 + length * 2, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, channels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true);
        view.setUint16(32, channels * 2, true);
        view.setUint16(34, 16, true);
        writeString(36, 'data');
        view.setUint32(40, length * 2, true);

        // 音声データ
        let offset = 44;
        for (let i = 0; i < length; i++) {
            const sample = Math.max(-1, Math.min(1, data[i]));
            view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
            offset += 2;
        }

        return arrayBuffer;
    }

    // ファイル名を生成（音名の組み合わせ）
    generateFileName(notes) {
        // 最初の数個の音名を取得（最大8個）
        const noteNames = notes.slice(0, 8).map(n => {
            // C4 -> C4, C#4 -> Cs4 のように変換（オクターブ番号は保持）
            return n.note.replace('#', 's');
        });
        
        const baseName = noteNames.join('_');
        // ファイル名が長すぎる場合は切り詰める
        const maxLength = 50;
        const truncatedName = baseName.length > maxLength 
            ? baseName.substring(0, maxLength) 
            : baseName;
        
        const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        return `melody_${truncatedName}_${timestamp}.wav`;
    }

    // WAVファイルをダウンロード
    downloadWAV(wavData, fileName) {
        const blob = new Blob([wavData], { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
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

