const { generateExam } = require("./generate-exam.js");
const fs = require("fs");
const path = require("path");

const examData = {
  filePrefix: "nandy-mock-02",
  title: "昌平区小升初英语模拟卷（第2套）",
  subtitle: "参照昌平区2023-2024六年级期末统考真题结构命制",
  meta: [
    "学生：Nandy | 学校：霍营小学 | 适用：昌平区小升初统考/分班考",
    "满分：100分 | 时长：60分钟 | 难度：★★★☆☆",
    "生成日期：2026-06-23",
  ],
  sections: [
    // ========== 第一部分：单词分类 ==========
    {
      title: "第一部分：单词分类（10分）",
      instruction: "选出每组中不同类的一项。参照昌平区2024六下期末真题题型。",
      summary: [
        "单词分类题考察词汇理解和归纳能力。昌平区真题每年必考，通常5-10小题。",
        "解题关键：看词性（名词/动词/形容词）、看语义场（动物/食物/职业等）。",
      ],
      items: [
        { type: "choice", num: 1, stem: "选出不同类的一项：", options: ["A. apple", "B. banana", "C. rice", "D. orange"], answer: "C", analysis: "rice是谷物/主食，其他三项是水果", tag: "词汇分类" },
        { type: "choice", num: 2, stem: "选出不同类的一项：", options: ["A. doctor", "B. teacher", "C. hospital", "D. nurse"], answer: "C", analysis: "hospital是场所，其他三项是职业", tag: "词汇分类" },
        { type: "choice", num: 3, stem: "选出不同类的一项：", options: ["A. spring", "B. summer", "C. weather", "D. winter"], answer: "C", analysis: "weather是统称，其他三项是具体季节", tag: "词汇分类" },
        { type: "choice", num: 4, stem: "选出不同类的一项：", options: ["A. bigger", "B. taller", "C. shorter", "D. worker"], answer: "D", analysis: "worker是职业名词，其他三项是比较级形容词", tag: "词汇分类" },
        { type: "choice", num: 5, stem: "选出不同类的一项：", options: ["A. went", "B. played", "C. visited", "D. today"], answer: "D", analysis: "today是时间副词，其他三项是动词过去式", tag: "词汇分类" },
      ],
      separator: true,
    },

    // ========== 第二部分：单项选择 ==========
    {
      title: "第二部分：单项选择（15分）",
      instruction: "从A、B、C、D四个选项中选出最佳答案。参照昌平区2023-2024真题高频考点命制。",
      summary: [
        "昌平区单选以语法辨析为主，时态（一般现在/现在进行/一般过去/一般将来）为核心。",
        "近年趋势：宾语从句语序、if条件句主将从现等初中知识点略有下沉，分班考常见。",
        "易错预警：第18题There be将来时、第24题现在完成时since、第29-30题从句综合。",
      ],
      items: [
        { type: "choice", num: 6, stem: "—Is there ______ university near your home? —Yes, and it's ______ famous one.", options: ["A. a; a", "B. a; the", "C. an; a", "D. an; the"], answer: "A", analysis: "university音标/juː/辅音开头→a；第二空泛指→a", tag: "冠词 | ⭐⭐⭐" },
        { type: "choice", num: 7, stem: "My cousin ______ to see me next month.", options: ["A. comes", "B. came", "C. is coming", "D. will coming"], answer: "C", analysis: "next month将来时间→现在进行时表将来。D选项will+coming语法错误", tag: "时态（进行时表将来）| ⭐⭐⭐⭐" },
        { type: "choice", num: 8, stem: "—______ is it from Changping to the city center? —About 40 kilometers.", options: ["A. How long", "B. How far", "C. How much", "D. How often"], answer: "B", analysis: "40km是距离→How far。How long问时间长度，How often问频率", tag: "疑问词 | ⭐⭐⭐" },
        { type: "choice", num: 9, stem: "There ______ a football match tomorrow afternoon.", options: ["A. is going to have", "B. is going to be", "C. will have", "D. are going to be"], answer: "B", analysis: "There be将来时=There is going to be/There will be。不可用have替换be", tag: "There be将来时 | ⭐⭐⭐⭐" },
        { type: "choice", num: 10, stem: "—Who taught you to swim? —Nobody. I taught ______.", options: ["A. me", "B. my", "C. mine", "D. myself"], answer: "D", analysis: "teach oneself自学→反身代词。I taught myself=I learned by myself", tag: "反身代词 | ⭐⭐⭐" },
        { type: "choice", num: 11, stem: "The boy is ______ to go to school by himself.", options: ["A. enough old", "B. old enough", "C. too old", "D. very old"], answer: "B", analysis: "enough修饰形容词时后置：adj.+enough。enough old语序错误", tag: "固定结构 | ⭐⭐⭐⭐" },
        { type: "choice", num: 12, stem: "—Must I finish the work today? —No, you ______.", options: ["A. mustn't", "B. can't", "C. needn't", "D. shouldn't"], answer: "C", analysis: "Must提问，否定回答用needn't/don't have to。mustn't表示禁止", tag: "情态动词 | ⭐⭐⭐" },
        { type: "choice", num: 13, stem: "Neither my father nor my mother ______ interested in video games.", options: ["A. are", "B. is", "C. be", "D. were"], answer: "B", analysis: "neither...nor就近原则→谓语与my mother一致→单数is", tag: "主谓一致 | ⭐⭐⭐⭐" },
        { type: "choice", num: 14, stem: "I have two brothers. One is a doctor, and ______ is a teacher.", options: ["A. other", "B. another", "C. the other", "D. others"], answer: "C", analysis: "两者中的另一个→the other。another是三者以上不定指", tag: "不定代词 | ⭐⭐⭐" },
        { type: "choice", num: 15, stem: "They ______ in Changping since they moved here in 2018.", options: ["A. live", "B. lived", "C. are living", "D. have lived"], answer: "D", analysis: "since+过去时间点→现在完成时have/has done。昌平区2024真题同类考点", tag: "现在完成时 | ⭐⭐⭐⭐" },
        { type: "choice", num: 16, stem: "—______ beautiful flowers they are! —Yes, and they smell so nice.", options: ["A. How", "B. What", "C. What a", "D. How a"], answer: "B", analysis: "What+形容词+可数名词复数！flowers是复数→不加a", tag: "感叹句 | ⭐⭐⭐" },
        { type: "choice", num: 17, stem: "My mother asks me ______ too much TV on school nights.", options: ["A. not watch", "B. not to watch", "C. don't watch", "D. to not watch"], answer: "B", analysis: "ask sb. not to do sth. 否定不定式结构", tag: "固定搭配 | ⭐⭐⭐⭐" },
        { type: "choice", num: 18, stem: "The funny story made all of us ______.", options: ["A. laugh", "B. laughed", "C. laughing", "D. to laugh"], answer: "A", analysis: "make sb. do使役动词后+动词原形作宾补", tag: "非谓语动词 | ⭐⭐⭐⭐" },
        { type: "choice", num: 19, stem: "—Could you tell me ______? —Go straight and turn left.", options: ["A. where is the post office", "B. where the post office is", "C. how can I get there", "D. which is the way"], answer: "B", analysis: "宾语从句用陈述语序（疑问词+主语+谓语）。AC语序错误", tag: "宾语从句语序 | ⭐⭐⭐⭐⭐" },
        { type: "choice", num: 20, stem: "I don't know if he ______ tomorrow. If he ______, I'll tell you.", options: ["A. comes; comes", "B. will come; comes", "C. comes; will come", "D. will come; will come"], answer: "B", analysis: "第一个if=whether引导宾语从句→将来时will come。第二个if引导条件状语从句→主将从现comes", tag: "if从句辨析 | ⭐⭐⭐⭐⭐" },
      ],
      separator: true,
    },

    // ========== 第三部分：选词填空 ==========
    {
      title: "第三部分：选词填空（10分）",
      instruction: "用方框中所给单词或短语的适当形式填空。参照昌平区2024六下期末真题题型。",
      summary: [
        "昌平区真题每年必考选词填空，通常10分5-10题。考察词汇+语法综合运用。",
        "解题步骤：①浏览方框词→②通读全文→③判断每空词性→④注意适当形式（时态/单复数/比较级等）。",
      ],
      items: [
        {
          type: "blank", num: "21-30",
          stem: "从方框中选择适当的单词或短语，用其适当形式填空。（10分）\n\n方框：go, be, swim, take, eat, play, visit, sunny, interest, careful\n\nLast summer, my family (21)______ to Qingdao for a holiday. The weather (22)______ hot and (23)______. We (24)______ in the sea every day. It was very (25)______. My father (26)______ many beautiful photos. We also (27)______ delicious seafood. One day, we (28)______ a famous aquarium and saw many sea animals. I (29)______ football on the beach with some new friends. Mom told us to be (30)______ near the water.",
          answer: "", analysis: "", tag: "选词填空（10空·适当形式）"
        },
      ],
      separator: true,
    },

    // ========== 第四部分：完形填空 ==========
    {
      title: "第四部分：完形填空（10分）",
      instruction: "通读短文，从每题所给的A、B、C、D四个选项中选出最佳答案。参照昌平区2023六下期末完形真题命制。",
      summary: [
        "昌平区完形填空难度适中，侧重故事类短文，10空×1分=10分。",
        "考点分布：3-4空语法（时态/介词/连词），3-4空词汇辨析，2-3空上下文逻辑。",
        "解题策略：跳过不会的空先读完全文→再回头逐空推敲→最后通读检查。",
      ],
      items: [
        {
          type: "cloze",
          passage: [
            "Mr. Wang is a 60-year-old man. He lives alone in a small village near the mountains. Every morning, he (31)______ early and takes a walk in the forest.",
            "",
            "One cold winter morning, Mr. Wang (32)______ a small bird on the ground. It looked (33)______ and couldn't fly. \"Poor little thing,\" he said. He carefully (34)______ the bird up and took it home.",
            "",
            "He made a warm bed for the bird and gave it some water. For the next few days, he (35)______ it carefully. Slowly, the bird became (36)______. It started to sing every morning. Mr. Wang felt very (37)______.",
            "",
            "When spring came, the bird was strong enough to fly again. He knew he had to let it (38)______. He opened the window and the bird flew out. But to his (39)______, the bird came back — and brought two (40)______ birds with it! Mr. Wang was never alone again.",
          ],
          blanks: [
            { num: 31, stem: "", options: ["A. gets up", "B. got up", "C. will get up", "D. is getting up"], answer: "A", analysis: "every morning→一般现在时", tag: "时态" },
            { num: 32, stem: "", options: ["A. finds", "B. found", "C. is finding", "D. will find"], answer: "B", analysis: "One cold winter morning→一般过去时", tag: "时态" },
            { num: 33, stem: "", options: ["A. strong", "B. weak", "C. happy", "D. beautiful"], answer: "B", analysis: "couldn't fly→虚弱(weak)", tag: "上下文逻辑" },
            { num: 34, stem: "", options: ["A. picked", "B. picks", "C. is picking", "D. picking"], answer: "A", analysis: "与found/took并列→过去时picked", tag: "时态" },
            { num: 35, stem: "", options: ["A. looked for", "B. looked at", "C. looked after", "D. looked up"], answer: "C", analysis: "look after=照顾；look for=寻找；look at=看；look up=查阅", tag: "动词短语辨析" },
            { num: 36, stem: "", options: ["A. worse", "B. weaker", "C. better", "D. angrier"], answer: "C", analysis: "started to sing→健康状况好转(got better)", tag: "上下文逻辑" },
            { num: 37, stem: "", options: ["A. sad", "B. worried", "C. angry", "D. happy"], answer: "D", analysis: "小鸟康复+唱歌→感到开心", tag: "上下文逻辑" },
            { num: 38, stem: "", options: ["A. goes", "B. go", "C. going", "D. to go"], answer: "B", analysis: "let sb./sth. do→使役动词+动词原形", tag: "非谓语动词" },
            { num: 39, stem: "", options: ["A. excitement", "B. surprise", "C. sadness", "D. worry"], answer: "B", analysis: "to one's surprise=令某人惊讶。小鸟回来了是意外之喜", tag: "固定短语" },
            { num: 40, stem: "", options: ["A. another", "B. other", "C. others", "D. the other"], answer: "B", analysis: "other+名词复数=其他的。another+单数, others=代词不用+名词", tag: "不定代词" },
          ],
        },
      ],
      separator: true,
    },

    // ========== 第五部分：阅读理解 ==========
    {
      title: "第五部分：阅读理解（20分）",
      instruction: "阅读下列短文，根据短文内容选择最佳答案。A篇为判断题（T/F），B篇为选择题。参照昌平区2023-2024期末真题。",
      summary: [
        "昌平区阅读通常2-3篇，含T/F判断和选择。2024年趋势：增加信息提取类题目。",
        "A篇（T/F判断）：原文中一般能直接找到对应句。注意not/never等否定词。",
        "B篇（选择）：难度略高于A篇，含推理判断题。",
      ],
      items: [
        // A篇 - 判断正误
        {
          type: "reading",
          label: "A",
          title: "A篇（判断题，10分）",
          passage: [
            "Notice: School Trip — Friday, June 27th",
            "",
            "7:45 — Meet at the school gate.",
            "8:00 — Take the school bus to the Science Museum (about 40 minutes).",
            "8:40-11:00 — Visit the museum: robots, space models, 3D ocean movie.",
            "11:00-11:30 — Walk to the nearby park (10 minutes).",
            "11:30-12:30 — Picnic lunch (bring your own food and drinks).",
            "12:30-2:00 — Games: football match & kite-flying competition.",
            "2:00-2:30 — Clean up and group photo.",
            "2:30 — Take the bus back to school. 3:10 — Arrive at school.",
            "",
            "Bring: hat, water bottle, lunch, notebook, pen.",
            "Do NOT bring: mobile phones, video games, too much money.",
            "If it rains, the trip will be on next Monday.",
          ],
          questions: [
            { num: 41, stem: "The trip is on Saturday, June 27th.", options: ["A. True", "B. False"], answer: "B", analysis: "原文Friday, June 27th→不是Saturday", tag: "T/F判断·细节" },
            { num: 42, stem: "Students will go to the Science Museum by school bus.", options: ["A. True", "B. False"], answer: "A", analysis: "原文Take the school bus→正确", tag: "T/F判断·细节" },
            { num: 43, stem: "Students will stay at the museum for about three hours.", options: ["A. True", "B. False"], answer: "B", analysis: "8:40-11:00≈2小时20分，不是3小时", tag: "T/F判断·计算" },
            { num: 44, stem: "Students can bring mobile phones to the trip.", options: ["A. True", "B. False"], answer: "B", analysis: "原文Do NOT bring mobile phones→不允许", tag: "T/F判断·细节" },
            { num: 45, stem: "If it rains, the trip will be on Monday.", options: ["A. True", "B. False"], answer: "A", analysis: "原文next Monday→正确", tag: "T/F判断·细节" },
          ],
        },
        // B篇 - 选择
        {
          type: "reading",
          label: "B",
          title: "B篇（选择题，10分）",
          passage: [
            "Many people think \"small talk\" — chatting about weather, sports, or TV shows — is boring. But scientists say small talk is actually very important.",
            "",
            "First, small talk helps people feel comfortable. When you meet someone new, you don't start with deep questions. You might say \"Nice weather today!\" These simple words can break the ice.",
            "",
            "Second, small talk can lead to real conversations. A chat about weather may turn into a talk about your favorite season, then your favorite holiday, and then your family traditions. Before you know it, you've made a new friend!",
            "",
            "Third, small talk is good for your health. Studies show that people who talk with others regularly — even just short greetings — feel happier and less lonely. A simple \"Good morning\" can brighten someone's day.",
            "",
            "So next time someone talks about the weather, don't just say \"yes\" and walk away. Use it as a chance to connect!",
          ],
          questions: [
            { num: 46, stem: "What is this passage mainly about?", options: ["A. How to talk about the weather", "B. Why small talk is important", "C. How to make new friends", "D. Why people feel lonely"], answer: "B", analysis: "主旨题。首段末句+全文围绕small talk重要性展开", tag: "阅读·主旨题" },
            { num: 47, stem: "\"Break the ice\" in Paragraph 2 means ______.", options: ["A. 打破冰块", "B. 打破沉默", "C. 打碎玻璃", "D. 打断谈话"], answer: "B", analysis: "词义猜测。语境：简单话语可以打破沉默/消除尴尬", tag: "阅读·词义猜测" },
            { num: 48, stem: "How many reasons does the writer give?", options: ["A. Two", "B. Three", "C. Four", "D. Five"], answer: "B", analysis: "First/Second/Third→三个理由", tag: "阅读·细节归纳" },
            { num: 49, stem: "Which is TRUE according to the passage?", options: ["A. Small talk is useless", "B. Always start with deep questions", "C. Small talk can lead to friendship", "D. Small talk is bad for health"], answer: "C", analysis: "推理判断。第二点：small talk→real conversations→make new friends", tag: "阅读·推理判断" },
            { num: 50, stem: "What does the writer suggest at the end?", options: ["A. Use small talk to connect with others", "B. Never talk about the weather", "C. Only talk to close friends", "D. Walk away when someone talks to you"], answer: "A", analysis: "末段：Use it as a chance to connect!", tag: "阅读·推理判断" },
          ],
        },
      ],
      separator: true,
    },

    // ========== 第六部分：词汇与句型 ==========
    {
      title: "第六部分：词汇与句型（20分）",
      instruction: "参照昌平区2023-2024期末真题结构和考点命制。",
      summary: [
        "昌平区词汇题每年必考：适当形式填空（动词时态/名词复数/形容词副词转换）。",
        "句型转换考察：否定句/一般疑问句/特殊疑问句/同义句转换。",
        "高频易错：buy→bought, tooth→teeth, shelf→shelves等不规则变化。",
      ],
      items: [
        // 词汇填空
        { type: "section_title", text: "A. 用括号内所给单词的适当形式填空（10分）" },
        { type: "blank", num: 51, stem: "My father enjoys ______ (fish) on weekends.", answer: "fishing", tag: "enjoy doing" },
        { type: "blank", num: 52, stem: "Tuesday is the ______ (three) day of the week.", answer: "third", tag: "序数词" },
        { type: "blank", num: 53, stem: "She ______ (buy) a gift for her mother last Sunday.", answer: "bought", tag: "过去式不规则" },
        { type: "blank", num: 54, stem: "Please speak ______ (loud). I can't hear you.", answer: "loudly", tag: "副词修饰动词" },
        { type: "blank", num: 55, stem: "This book is ______ (interesting) than that one.", answer: "more interesting", tag: "多音节比较级" },
        { type: "blank", num: 56, stem: "We should brush our ______ (tooth) twice a day.", answer: "teeth", tag: "不规则复数" },
        { type: "blank", num: 57, stem: "It's ______ (danger) to swim in the river alone.", answer: "dangerous", tag: "名词→形容词" },
        { type: "blank", num: 58, stem: "The children enjoyed ______ (they) at the party.", answer: "themselves", tag: "enjoy oneself" },
        { type: "blank", num: 59, stem: "There are two ______ (shelf) in my study.", answer: "shelves", tag: "f→ves" },
        { type: "blank", num: 60, stem: "He ______ (not finish) his homework yet.", answer: "hasn't finished", tag: "现在完成时+yet" },
        // 句型转换
        { type: "section_title", text: "B. 按要求完成句子（10分）" },
        { type: "blank", num: 61, stem: "He read a storybook last night.（改为否定句）\n________________________________________", answer: "He didn't read a storybook last night.", tag: "过去时否定 didn't+原形" },
        { type: "blank", num: 62, stem: "There are some trees behind the house.（改为一般疑问句）\n________________________________________", answer: "Are there any trees behind the house?", tag: "There be疑问+some→any" },
        { type: "blank", num: 63, stem: "The boy is playing basketball now.（对playing basketball提问）\n________________________________________", answer: "What is the boy doing now?", tag: "现在进行时特殊疑问句" },
        { type: "blank", num: 64, stem: "She went to Beijing by train.（对by train提问）\n________________________________________", answer: "How did she go to Beijing?", tag: "交通方式→How" },
        { type: "blank", num: 65, stem: "Tom is 1.65m tall. Jack is 1.65m tall, too.（合并为一句）\n________________________________________", answer: "Tom is as tall as Jack.", tag: "as...as同级比较" },
      ],
      separator: true,
    },

    // ========== 第七部分：书面表达 ==========
    {
      title: "第七部分：书面表达（15分）",
      instruction: "参照昌平区2024六下期末书面表达真题（提纲作文·描述人物）命制。",
      summary: [
        "昌平区书面表达通常为提纲作文，给出3-5个要点，要求不少于5句话（60-80词）。",
        "2024年真题为描述难忘的人/事。本题适配调整为My Favorite Teacher。",
        "评分维度：内容完整（5分）、语言准确（5分）、结构清晰（3分）、书写规范（2分）。",
        "高分技巧：开头点题+中间2-3句具体描述+结尾升华，避免全篇简单句。",
      ],
      items: [
        {
          type: "writing",
          title: "题目：My Favorite Teacher",
          prompts: [
            { num: 1, text: "Who is your favorite teacher? (name + subject)" },
            { num: 2, text: "What does he/she look like?" },
            { num: 3, text: "Why do you like him/her? (at least two reasons)" },
            { num: 4, text: "What do you want to say to him/her?" },
          ],
          wordCount: "60-80词（不少于5句话）",
          lines: 8,
          sample: [
            "My favorite teacher is Miss Zhang. She is our English teacher. She is tall and thin with long black hair. She always wears a warm smile.",
            "",
            "I like Miss Zhang for two reasons. First, her classes are very interesting. She often tells us English stories and plays games with us. Second, she is very kind and patient. When we make mistakes, she never gets angry but encourages us to try again.",
            "",
            "I want to say: \"Thank you, Miss Zhang! You make me fall in love with English!\"",
          ],
          rubric: [
            "【内容完整 5分】是否覆盖全部4个要点",
            "【语言准确 5分】语法、拼写、标点是否正确（每处错误扣0.5分，扣完为止）",
            "【结构清晰 3分】是否有开头-中间-结尾，是否使用连接词(First/Second/)",
            "【书写规范 2分】字迹是否整洁、格式是否规范",
          ],
        },
      ],
    },
  ],
};

// 运行
const outputDir = path.join(__dirname, "..", "exams");
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

generateExam(examData, outputDir).then(({ questionPath, answerPath }) => {
  console.log("\n✅ 生成完成！");
  console.log(`   题目版：${questionPath}`);
  console.log(`   答案版：${answerPath}`);
}).catch(err => {
  console.error("生成失败：", err);
  process.exit(1);
});
