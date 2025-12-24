// ストーリー管理クラス
class StoryManager {
    constructor() {
        this.currentChapter = 1;
        this.currentStoryIndex = 0;
        this.stories = this.initializeStories();
    }

    initializeStories() {
        return {
            1: [
                {
                    title: "第1章：はじめてのメロディー",
                    text: "異世界に転生したあなた。目覚めると、そこは猫人が住む村でした。\n\n音程猫とリズム猫があなたの前に現れます。彼らは音で会話をします。\n\nカードを組み合わせて、メロディーを紡いでみましょう。"
                },
                {
                    title: "チュートリアル",
                    text: "リズム猫のカードと音程猫のカードを五線紙にドラッグして配置してください。\n\n小節が完全に埋まると、カードが確定され、音が流れます。\n\n16小節分のメロディーを完成させましょう！"
                }
            ],
            2: [
                {
                    title: "第2章：森の賢王",
                    text: "第1章のメロディーに満足した猫たち。\n\nしかし、森の賢王が現れ、そのメロディーに不満を述べました。\n\n「もっと高みを目指せ」と賢王は言います。\n\nさらなる美しいメロディーを作り、賢王を満足させてください。"
                }
            ],
            3: [
                {
                    title: "第3章：お祭りのメロディー",
                    text: "満足した森の賢王は、あなたに感謝の言葉を述べました。\n\nそして、みんなでお祭りを開くことになりました。\n\n最後のメロディーを作り、みんなで踊り、歌いましょう！"
                }
            ]
        };
    }

    // 現在のストーリーを取得
    getCurrentStory() {
        const chapterStories = this.stories[this.currentChapter];
        if (!chapterStories || this.currentStoryIndex >= chapterStories.length) {
            return null;
        }
        return chapterStories[this.currentStoryIndex];
    }

    // 次のストーリーに進む
    nextStory() {
        const chapterStories = this.stories[this.currentChapter];
        if (chapterStories && this.currentStoryIndex < chapterStories.length - 1) {
            this.currentStoryIndex++;
            return this.getCurrentStory();
        }
        return null;
    }

    // 章を進める
    advanceChapter() {
        this.currentChapter++;
        this.currentStoryIndex = 0;
    }

    // ストーリーを表示
    showStory(overlayElement, titleElement, textElement, nextButton) {
        const story = this.getCurrentStory();
        if (!story) {
            overlayElement.classList.add('hidden');
            return;
        }

        titleElement.textContent = story.title;
        textElement.textContent = story.text;
        overlayElement.classList.remove('hidden');
    }

    // ストーリーを非表示
    hideStory(overlayElement) {
        overlayElement.classList.add('hidden');
    }
}

