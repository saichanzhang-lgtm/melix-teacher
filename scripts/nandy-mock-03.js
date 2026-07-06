const { generateExam } = require("./generate-exam.js");
const fs = require("fs");
const path = require("path");

const examData = {
  filePrefix: "nandy-mock-03",
  title: "昌平区小升初英语模拟卷（第3套）",
  subtitle: "参照北京市初一年级难度命制，适用于小升初分班考试备考",
  meta: [
    "学生：Nandy | 学校：霍营小学 | 适用：昌平区小升初统考/分班考",
    "满分：100分 | 时长：60分钟 | 难度：★★★★☆（对标初一）",
    "生成日期：2026-06-30 | 来源：参考北京市2023-2024初一期末真题+昌平区分班考真题改编",
  ],
  sections: [
    // ============================================================
    // 一、单项选择（15题×1分=15分）—— 北京市初一年级语法难度
    // ============================================================
    {
      title: "一、单项选择（共15小题，每小题1分，满分15分）",
      instruction: "从A、B、C、D四个选项中选出最佳答案。语法难度对标北京市初一年级（七年级上/下册）。",
      summary: [
        "本部分覆盖人教Go for it七上+七下核心语法考点：冠词、代词、介词、一般现在时（三单）、现在进行时、一般过去时、一般将来时、情态动词can、祈使句、特殊疑问词、频度副词、would like、形容词/副词辨析、be动词过去式。",
        "每题标注考点标签+难度星级+教材来源，便于考后精准定位薄弱语法点。",
      ],
      items: [
        {
          type: "inlineChoice", num: 1,
          stem: "There is ______ \"h\" and ______ \"u\" in the word \"hour\".",
          options: ["A. a; an", "B. an; a", "C. a; a", "D. an; an"],
          answer: "B", analysis: "h音标/eɪtʃ/以元音开头→an; u音标/juː/以辅音开头→a。陷阱：不要被字母本身迷惑，看发音。", tag: "冠词 a/an | ⭐⭐⭐ | 人教七上U1-2"
        },
        {
          type: "inlineChoice", num: 2,
          stem: "—Is this ______ schoolbag? —No, ______ is in the classroom.",
          options: ["A. your; my", "B. your; mine", "C. yours; my", "D. yours; mine"],
          answer: "B", analysis: "第一空后有名詞schoolbag→形容词性物主代词your；第二空后无名詞→名詞性物主代词mine。", tag: "物主代词 | ⭐⭐⭐ | 人教七上U3"
        },
        {
          type: "inlineChoice", num: 3,
          stem: "We usually get up ______ 6:30 ______ weekdays.",
          options: ["A. at; on", "B. at; in", "C. on; at", "D. in; on"],
          answer: "A", analysis: "具体时刻用at→at 6:30；星期几/工作日用on→on weekdays。on也可用于具体某天的上下午：on Monday morning。", tag: "时间介词 | ⭐⭐⭐ | 人教七下U2"
        },
        {
          type: "inlineChoice", num: 4,
          stem: "—______ there any milk in the glass? —Yes, there ______.",
          options: ["A. Is; is", "B. Are; are", "C. Is; are", "D. Are; is"],
          answer: "A", analysis: "milk是不可数名词→视为单数→There is。易错：any既可接可数复数也可接不可数名词。", tag: "There be | ⭐⭐⭐⭐ | 人教七下U8"
        },
        {
          type: "inlineChoice", num: 5,
          stem: "Linda ______ from England. She ______ Chinese food very much.",
          options: ["A. come; like", "B. comes; likes", "C. come; likes", "D. comes; like"],
          answer: "B", analysis: "Linda是第三人称单数→come+s=comes, like+s=likes。一般现在时三单规则：大多数动词直接+s。", tag: "一般现在时/三单 | ⭐⭐⭐ | 人教七上U1-U2"
        },
        {
          type: "inlineChoice", num: 6,
          stem: "—Where is Tom? —He ______ a book in the library.",
          options: ["A. reads", "B. read", "C. is reading", "D. will read"],
          answer: "C", analysis: "Where is Tom?问的是此刻在哪儿→用现在进行时am/is/are+doing。reads是一般现在时，表示经常性动作。", tag: "现在进行时 | ⭐⭐⭐⭐ | 人教七下U6"
        },
        {
          type: "inlineChoice", num: 7,
          stem: "My mother ______ some vegetables at the market yesterday.",
          options: ["A. buy", "B. buys", "C. bought", "D. will buy"],
          answer: "C", analysis: "yesterday→一般过去时。buy是不规则动词，过去式为bought。七下U12核心不规则动词之一。", tag: "一般过去时(不规则) | ⭐⭐⭐⭐ | 人教七下U12"
        },
        {
          type: "inlineChoice", num: 8,
          stem: "I ______ to the zoo with my friends tomorrow morning.",
          options: ["A. go", "B. went", "C. will go", "D. goes"],
          answer: "C", analysis: "tomorrow morning→一般将来时will+动词原形。注意go是不规则动词，但will后永远接原形。", tag: "一般将来时 | ⭐⭐⭐ | 人教七下·衔接八上U6"
        },
        {
          type: "inlineChoice", num: 9,
          stem: "—______ you play the piano? —Yes, I can.",
          options: ["A. Can", "B. May", "C. Must", "D. Need"],
          answer: "A", analysis: "从答语Yes, I can.反推→问句用Can。Can表能力（会做某事），情态动词后接动词原形。", tag: "情态动词can | ⭐⭐⭐ | 人教七下U1"
        },
        {
          type: "inlineChoice", num: 10,
          stem: "______ in the hallway. It's very dangerous.",
          options: ["A. Not run", "B. Don't run", "C. Not running", "D. No run"],
          answer: "B", analysis: "祈使句否定形式：Don't+动词原形。结构=Don't+do。A选项Not run缺少助动词do，语法错误。", tag: "祈使句 | ⭐⭐⭐ | 人教七下U4"
        },
        {
          type: "inlineChoice", num: 11,
          stem: "—______ is it from your home to the subway station? —About 500 meters.",
          options: ["A. How long", "B. How far", "C. How often", "D. How many"],
          answer: "B", analysis: "回答是距离(500米)→用How far问距离。How long问时间长度或物体长度；How often问频率。", tag: "特殊疑问词 | ⭐⭐⭐⭐ | 人教七下U3"
        },
        {
          type: "inlineChoice", num: 12,
          stem: "My brother ______ eats junk food because he thinks it's unhealthy.",
          options: ["A. always", "B. usually", "C. often", "D. never"],
          answer: "D", analysis: "because it's unhealthy→既然认为不健康，逻辑上应该是\"从不吃\"→never（0%频率）。always是100%，usually是80%，often是60%。", tag: "频度副词 | ⭐⭐⭐ | 人教七下U2"
        },
        {
          type: "inlineChoice", num: 13,
          stem: "—What ______ you like for dinner? —I'd like some dumplings and soup.",
          options: ["A. do", "B. would", "C. are", "D. can"],
          answer: "B", analysis: "从答语I'd like反推→问句用Would...like?。I'd like=I would like，表示委婉的意愿。", tag: "would like | ⭐⭐⭐ | 人教七下U10"
        },
        {
          type: "inlineChoice", num: 14,
          stem: "The girl sings very ______. She is a ______ singer in our school.",
          options: ["A. beautiful; beautiful", "B. beautifully; beautifully", "C. beautifully; beautiful", "D. beautiful; beautifully"],
          answer: "C", analysis: "第一空修饰动词sings→用副词beautifully；第二空修饰名詞singer→用形容词beautiful。形/副辨析：形容词修饰名詞，副词修饰动词/形容词/副词。", tag: "形容词/副词辨析 | ⭐⭐⭐⭐ | 七下高频考点"
        },
        {
          type: "inlineChoice", num: 15,
          stem: "—Where ______ you yesterday afternoon? —I ______ at the sports center.",
          options: ["A. was; was", "B. were; were", "C. was; were", "D. were; was"],
          answer: "D", analysis: "第一空主语you→be过去式用were；第二空主语I→be过去式用was。am/is→was, are→were。", tag: "be动词过去式 | ⭐⭐⭐ | 人教七下U11-12"
        },
      ],
      separator: true,
    },

    // ============================================================
    // 二、选词填空（10空×1分=10分）
    // ============================================================
    {
      title: "二、选词填空（共10小题，每小题1分，满分10分）",
      instruction: "阅读短文，从方框中选择适当的词并用其正确形式填空。每词限用一次，方框中有两个多余选项。",
      summary: [
        "选词填空考察词汇+语法综合运用。解题步骤：①浏览方框，判断每个词的词性和可能变形；②通读全文，判断每空需要的词性（名词/动词/形容词/副词）；③根据上下文时态确定动词形式；④代入后通读检查。",
        "本选词填空短文改编自北京2023海淀初一期末真题同类题型，词汇范围：人教七下核心词表。",
      ],
      items: [
        {
          type: "wordbank",
          wordBank: ["read", "go", "be", "have", "play", "visit", "careful", "quick", "they", "interest", "sun", "rain"],
          passage: [
            "Last Sunday, my friends and I (16)______ to the Summer Palace. The weather (17)______ warm and (18)______. There (19)______ many tourists from different countries.",
            "",
            "We walked around Kunming Lake and took many beautiful photos. At noon, we (20)______ a picnic under a big tree near the lake. After lunch, I (21)______ a storybook about Chinese history while my friends (22)______ soccer on the grass. An old man sitting nearby told us some (23)______ stories about the history of the palace. We all listened (24)______ and learned a lot.",
            "",
            "It started to (25)______ in the late afternoon, so we packed up and went home. It was a wonderful day!",
          ],
          answers: [
            { num: 16, answer: "went", tag: "go→went 过去式 | Last Sunday→过去时" },
            { num: 17, answer: "was", tag: "be→was | weather不可数→单数, 过去时" },
            { num: 18, answer: "sunny", tag: "sun→sunny 形容词 | 阳光明媚的" },
            { num: 19, answer: "were", tag: "be→were | tourists复数→过去时were" },
            { num: 20, answer: "had", tag: "have→had 过去式 | have a picnic 野餐" },
            { num: 21, answer: "read", tag: "read→read 过去式 | 拼写不变, 发音变化" },
            { num: 22, answer: "played", tag: "play→played 规则变化 | play soccer 踢足球" },
            { num: 23, answer: "interesting", tag: "interest→interesting 形容词 | 修饰stories" },
            { num: 24, answer: "carefully", tag: "careful→carefully 副词 | 修饰listened" },
            { num: 25, answer: "rain", tag: "rain→rain 原形 | start to do sth." },
          ],
        },
      ],
      separator: true,
    },

    // ============================================================
    // 三、完形填空（20空×1分=20分）
    // ============================================================
    {
      title: "三、完形填空（共20小题，每小题1分，满分20分）",
      instruction: "通读下面短文，从每题所给的A、B、C、D四个选项中选出最佳答案。改编自北京市2023海淀初一期末完形真题风格——故事类短文，侧重上下文逻辑推理。",
      summary: [
        "完形填空解题策略：跳过不会的空，先通读全文把握故事脉络→再逐空推敲（结合上下文线索+语法规则+词汇搭配）→最后代入答案通读检查。",
        "本完形考点分布：时态判断5题、词汇辨析6题、上下文逻辑4题、固定搭配3题、代词指代2题。",
        "出处：改编自2023海淀七下期末完形真题同源素材，难度与原文一致。",
      ],
      items: [
        {
          type: "cloze",
          passage: [
            "When I was in Grade 6, I had a best friend named David. We did almost (26)______ together — we sat next to each other in class, ate lunch together, and walked home together after school every day.",
            "",
            "One Monday morning, our math teacher, Mrs. Chen, (27)______ that we would have a test on Friday. \"This test is very important,\" she said. \"It will (28)______ everything we've learned this semester. Please study (29)______.\"",
            "",
            "I was not (30)______ about the test because math was my (31)______ subject. In fact, I often helped my classmates with their math homework. But David looked very (32)______. \"I'm (33)______ at math,\" he said. \"I don't think I can (34)______ the test.\"",
            "",
            "\"Don't worry,\" I told him. \"I can (35)______ you study after school this week.\"",
            "",
            "For the next three days, David and I (36)______ together every afternoon. I (37)______ him how to solve different types of problems. David was a quick (38)______, and he improved very fast. By Thursday evening, he (39)______ answer most of the practice questions (40)______.",
            "",
            "On Friday morning, I felt confident. The test started at 8:30. I answered the first ten questions (41)______. But when I turned to the next page, I noticed something (42)______ — David was copying my answers! He could see my paper (43)______ we sat so close to each other.",
            "",
            "I didn't know what to (44)______. David was my best friend, (45)______ what he was doing was wrong. I moved my arm to (46)______ my paper. David looked at me with a surprised face, but I just shook my head (47)______.",
            "",
            "After the test, David came to me. \"I'm sorry,\" he said, his eyes looking at the (48)______. \"I was so afraid of (49)______ the test. I know it was wrong.\"",
            "",
            "I forgave him. \"It's okay. But promise me you'll never do that again. It's better to (50)______ a test than to cheat.\"",
            "",
            "From that day on, David never cheated again. And we (51)______ best friends. This experience taught (52)______ of us an important (53)______: true friendship means helping each other do the (54)______ thing, not the (55)______ thing.",
          ],
          blanks: [
            { num: 26, stem: "", options: ["A. everything", "B. nothing", "C. something", "D. anything"], answer: "A", analysis: "下文列举一起做很多事→几乎一起做每件事→everything", tag: "不定代词 | 上下文逻辑" },
            { num: 27, stem: "", options: ["A. told", "B. said", "C. talked", "D. spoke"], answer: "B", analysis: "said that...宣布/告知。announced=said that。told需接人(told us that...)", tag: "动词辨析 say/tell | 词汇辨析" },
            { num: 28, stem: "", options: ["A. cover", "B. discover", "C. recover", "D. uncover"], answer: "A", analysis: "cover=涵盖/覆盖。cover everything we've learned=涵盖所有学过的内容", tag: "动词词义 | 词汇辨析" },
            { num: 29, stem: "", options: ["A. hard", "B. hardly", "C. easy", "D. easily"], answer: "A", analysis: "study hard=努力学习。hardly=几乎不(意思不同)。study是动词→副词修饰, hard本身可作副词。", tag: "hard vs hardly | ⭐⭐⭐⭐" },
            { num: 30, stem: "", options: ["A. worried", "B. excited", "C. angry", "D. surprised"], answer: "A", analysis: "因为数学好→不担心→not worried。后文David worried形成对比。", tag: "形容词 | 上下文逻辑" },
            { num: 31, stem: "", options: ["A. worst", "B. hardest", "C. best", "D. easiest"], answer: "C", analysis: "I often helped others with math→数学是我最好(best)的科目。easiest也对但best更贴切\"擅长\"。", tag: "形容词最高级 | 上下文逻辑" },
            { num: 32, stem: "", options: ["A. happy", "B. excited", "C. worried", "D. bored"], answer: "C", analysis: "David数学不好→看起来很担心(worried)。与\"我\"的不担心形成对比。", tag: "形容词 | 上下文逻辑" },
            { num: 33, stem: "", options: ["A. good", "B. well", "C. terrible", "D. excellent"], answer: "C", analysis: "be terrible at=在……方面很糟。也可以说be bad at。后文说考不过→选terrible。", tag: "形容词+介词搭配 | 固定搭配" },
            { num: 34, stem: "", options: ["A. pass", "B. fail", "C. take", "D. finish"], answer: "A", analysis: "pass the test=通过考试。担心考不过→don't think I can pass。", tag: "动词搭配 | 词汇辨析" },
            { num: 35, stem: "", options: ["A. help", "B. watch", "C. let", "D. make"], answer: "A", analysis: "help sb. (to) do sth.=帮助某人做某事。后接动词原形。", tag: "help的用法 | 固定搭配" },
            { num: 36, stem: "", options: ["A. study", "B. studied", "C. studies", "D. were studying"], answer: "B", analysis: "For the next three days讲述过去发生的事→一般过去时studied。规则动词+y→ied。", tag: "一般过去时 | 时态判断" },
            { num: 37, stem: "", options: ["A. asked", "B. gave", "C. taught", "D. showed"], answer: "C", analysis: "teach sb. how to do=教某人如何做。后文David进步→\"我\"教他。", tag: "动词辨析 | 词汇辨析" },
            { num: 38, stem: "", options: ["A. teacher", "B. learner", "C. worker", "D. runner"], answer: "B", analysis: "a quick learner=学得很快的人。后文he improved very fast→证明他学得快。", tag: "名词搭配 | 词汇辨析" },
            { num: 39, stem: "", options: ["A. can", "B. could", "C. must", "D. should"], answer: "B", analysis: "全文是过去时(By Thursday evening)→can的过去式could。他已经能做对大部分题了。", tag: "情态动词过去式 | 时态判断" },
            { num: 40, stem: "", options: ["A. correctly", "B. wrongly", "C. quietly", "D. loudly"], answer: "A", analysis: "improved very fast→能做对→correctly正确地。做对题目用correctly/right。", tag: "副词 | 上下文逻辑" },
            { num: 41, stem: "", options: ["A. easily", "B. difficultly", "C. slowly", "D. nervously"], answer: "A", analysis: "felt confident→自信→轻松地(easily)答完了前十题。", tag: "副词 | 上下文逻辑" },
            { num: 42, stem: "", options: ["A. interesting", "B. exciting", "C. strange", "D. funny"], answer: "C", analysis: "David在抄答案→\"我\"注意到奇怪(strange)的事。不是有趣(interesting)或好笑(funny)。", tag: "形容词辨析 | 上下文逻辑" },
            { num: 43, stem: "", options: ["A. because", "B. although", "C. unless", "D. until"], answer: "A", analysis: "他能看到我的试卷因为我们(because)坐得很近。因果关系。", tag: "连词 | 固定搭配" },
            { num: 44, stem: "", options: ["A. say", "B. do", "C. talk", "D. speak"], answer: "B", analysis: "what to do=该做什么。全文时态过去但what to do是固定表达，不用变时态。", tag: "疑问词+不定式 | 固定搭配" },
            { num: 45, stem: "", options: ["A. so", "B. and", "C. but", "D. or"], answer: "C", analysis: "他是最好的朋友(but)他在做的事是错的→转折关系。", tag: "连词 | 上下文逻辑" },
            { num: 46, stem: "", options: ["A. show", "B. hide", "C. cover", "D. share"], answer: "C", analysis: "cover my paper=遮住试卷(防止被抄)。hide=隐藏(不让人找到)；cover=遮盖(挡住视线)。", tag: "动词辨析 cover/hide | 词汇辨析" },
            { num: 47, stem: "", options: ["A. heavily", "B. loudly", "C. carefully", "D. slightly"], answer: "D", analysis: "shook my head slightly=轻轻摇头。slightly=轻微地。从语境看是含蓄的提醒，不是剧烈动作。", tag: "副词 | 词汇辨析" },
            { num: 48, stem: "", options: ["A. sky", "B. ground", "C. window", "D. teacher"], answer: "B", analysis: "looking at the ground=看着地面(表示羞愧/不好意思)。固定表达：羞愧时低头看地。", tag: "习惯表达 | 上下文逻辑" },
            { num: 49, stem: "", options: ["A. passing", "B. taking", "C. failing", "D. finishing"], answer: "C", analysis: "was afraid of failing=害怕不及格。afraid of+doing。对应前文担心考不过。", tag: "afraid of doing | 固定搭配" },
            { num: 50, stem: "", options: ["A. pass", "B. fail", "C. get", "D. lose"], answer: "B", analysis: "宁可考试不及格(fail)也不作弊(cheat)。与前文34空的pass形成对比：It's better to fail than to cheat.", tag: "动词 | 上下文逻辑·对比" },
            { num: 51, stem: "", options: ["A. became", "B. stayed", "C. turned", "D. changed"], answer: "B", analysis: "stayed best friends=还是最好的朋友。作弊事件没有破坏友谊→友谊保持不变(stayed)。", tag: "动词辨析 | 词汇辨析" },
            { num: 52, stem: "", options: ["A. all", "B. either", "C. neither", "D. both"], answer: "D", analysis: "taught both of us=教会了我们两个人。both指两者都。all是三者以上。两人用both。", tag: "代词 both/all | ⭐⭐⭐" },
            { num: 53, stem: "", options: ["A. subject", "B. lesson", "C. class", "D. story"], answer: "B", analysis: "an important lesson=重要的一课/教训。teach sb. a lesson=给某人一个教训/教会某人一个道理。", tag: "名词搭配 | 词汇辨析" },
            { num: 54, stem: "", options: ["A. right", "B. easy", "C. new", "D. old"], answer: "A", analysis: "the right thing=正确的事。与下文的easy thing形成对比：做正确的事vs做容易的事。", tag: "形容词 | 上下文逻辑·对比" },
            { num: 55, stem: "", options: ["A. hard", "B. easy", "C. wrong", "D. difficult"], answer: "B", analysis: "the easy thing=容易的事。尾句点题：真正的友谊是帮彼此做正确(right)的事，而非容易(easy)的事。", tag: "形容词 | 上下文逻辑·对比" },
          ],
        },
      ],
      separator: true,
    },

    // ============================================================
    // 四、阅读理解（2篇×5题×2分=20分）
    // ============================================================
    {
      title: "四、阅读理解（共10小题，每小题2分，满分20分）",
      instruction: "阅读下列两篇短文，根据短文内容选择最佳答案。两篇均为初一年级难度，文章来源：改编自北京市海淀区2023-2024初一期末真题同类素材。",
      summary: [
        "A篇：校园生活类——关于学校英语阅读俱乐部的故事，约250词。考察细节查找、推理判断、主旨大意。",
        "B篇：科普类——关于海豚惊人记忆力的科普文章，约300词。考察主旨概括、细节理解、词义推断、作者意图。",
        "阅读策略：先读题目→带着问题读文章→找到对应句→排除干扰项。",
      ],
      items: [
        // ---------- A篇 ----------
        {
          type: "reading",
          label: "A",
          title: "A篇",
          passage: [
            "Last September, our school started a new after-school activity — the English Reading Club. At first, I didn't want to join because I thought reading English books would be boring. But my best friend Amy kept asking me to go with her, so I finally said yes.",
            "",
            "The club meets every Tuesday and Thursday after school in the school library. There are about 20 students from different grades. Our teacher, Miss Wang, chooses interesting English storybooks for us. They are not the difficult textbooks we use in class. Instead, they are real stories about kids like us — about school life, friendship, and adventures in different countries.",
            "",
            "In the club, we don't just read silently. Sometimes we read aloud together, and Miss Wang helps correct our pronunciation. Sometimes we act out scenes from the story, which is a lot of fun. My favorite part is the \"book talk\" — every month, we choose one book and discuss what we liked, what we learned, and how we felt about the characters. Everyone gets to share their ideas.",
            "",
            "After six months in the club, I can honestly say it has changed my life. My English has improved a lot, especially my vocabulary and reading speed. But more importantly, I've discovered that reading English books can be fun and exciting! Last week, I finished my fifth English book — a wonderful story about a boy who traveled around the world. Now I can't wait to start the next one. I'm so glad Amy asked me to join!",
          ],
          questions: [
            { num: 56, stem: "When did the school start the English Reading Club?", options: ["A. Last September", "B. Last October", "C. Six months ago", "D. Last year"], answer: "A", analysis: "细节题。原文第一句：Last September, our school started...答案直接。", tag: "阅读·细节理解" },
            { num: 57, stem: "Why didn't the writer want to join the club at first?", options: ["A. Because it was too expensive", "B. Because she thought reading would be boring", "C. Because she had no free time", "D. Because she didn't like Amy"], answer: "B", analysis: "细节题。原文：I thought reading English books would be boring。", tag: "阅读·细节理解" },
            { num: 58, stem: "How often does the Reading Club meet?", options: ["A. Once a week", "B. Twice a week", "C. Every day", "D. Twice a month"], answer: "B", analysis: "原文: every Tuesday and Thursday→每周两次→Twice a week。", tag: "阅读·细节推断" },
            { num: 59, stem: "What is the \"book talk\"?", options: ["A. Reading books silently in the library", "B. Acting out scenes from a storybook", "C. Discussing a book and sharing ideas together", "D. Correcting each other's pronunciation"], answer: "C", analysis: "细节推断题。原文：discuss what we liked, what we learned, and how we felt...Everyone gets to share their ideas→讨论+分享=book talk。", tag: "阅读·细节理解" },
            { num: 60, stem: "What is the main idea of this passage?", options: ["A. How to learn English vocabulary quickly", "B. The writer's best friend Amy is very kind", "C. How the Reading Club changed the writer's life", "D. English textbooks are too difficult for students"], answer: "C", analysis: "主旨题。全文围绕\"我\"从不想参加→参加→改变的过程展开，最后一段明确点题：it has changed my life。", tag: "阅读·主旨大意" },
          ],
        },
        // ---------- B篇 ----------
        {
          type: "reading",
          label: "B",
          title: "B篇",
          passage: [
            "Dolphins are known for being one of the smartest animals in the ocean. Scientists have studied them for many years and have discovered something truly amazing — dolphins have an excellent memory that can last for more than 20 years!",
            "",
            "In a famous study, researchers at the University of Chicago worked with 43 dolphins over a period of several years. These dolphins lived in different places across the United States. The researchers found that dolphins could remember the special whistle sounds of other dolphins they had lived with, even after being separated for more than two decades. Each dolphin has its own \"signature whistle\" — a special sound that works just like a name. It is different for every dolphin, just like human fingerprints! When the researchers played recordings of old tank-mates' whistles, the dolphins would swim toward the speaker, showing that they recognized their long-lost friends.",
            "",
            "But that's not all. Dolphins don't just remember each other — they can also remember tasks and tricks they learned years ago! Some dolphins in the study could still perform actions they had been taught 15 years earlier, even though they hadn't practiced them since then. This kind of long-term memory is very rare in the animal world. In fact, scientists say that dolphins' memory ability might be second only to humans.",
            "",
            "Why do dolphins need such a good memory? Scientists believe it helps them survive in the wild. Dolphins live in large and complex social groups, and remembering who is a friend and who is not can be very important for their safety. A good memory also helps dolphins remember where to find food in the huge ocean and how to avoid dangerous areas. For dolphin mothers, remembering which fish are safe to eat and which places have clean water is especially important for raising their babies.",
            "",
            "So the next time you see a dolphin at an aquarium or in a nature show, remember — it might just remember you, too!",
          ],
          questions: [
            { num: 61, stem: "What is this passage mainly about?", options: ["A. How dolphins learn to swim fast", "B. The different kinds of dolphins in the ocean", "C. Dolphins' amazing memory ability", "D. What dolphins like to eat every day"], answer: "C", analysis: "主旨题。全篇围绕dolphins' memory展开：首段点题→研究证据→记忆的用途。关键词memory贯穿全文。", tag: "阅读·主旨大意" },
            { num: 62, stem: "According to the passage, how long can dolphins remember other dolphins?", options: ["A. About a few months", "B. More than 5 years", "C. More than 20 years", "D. More than 50 years"], answer: "C", analysis: "细节题。首段：more than 20 years；第二段：more than two decades(二十年)。", tag: "阅读·细节理解" },
            { num: 63, stem: "What is a \"signature whistle\" in Paragraph 2?", options: ["A. A kind of food that dolphins eat", "B. A special sound that works like a dolphin's name", "C. A type of dolphin that lives in Chicago", "D. A swimming style used by baby dolphins"], answer: "B", analysis: "词语理解。原文：a special sound that works just like a name+It is different for every dolphin→像名字一样的特殊声音。", tag: "阅读·词义推断" },
            { num: 64, stem: "What did the dolphins do when they heard old friends' whistles?", options: ["A. They swam away quickly", "B. They made louder sounds back", "C. They swam toward the speaker", "D. They did nothing at all"], answer: "C", analysis: "细节题。原文：the dolphins would swim toward the speaker, showing that they recognized their long-lost friends。", tag: "阅读·细节理解" },
            { num: 65, stem: "Which of the following is NOT mentioned as a reason why dolphins need good memory?", options: ["A. To remember who is a friend and who is not", "B. To find food in the ocean", "C. To avoid dangerous areas", "D. To communicate with humans better"], answer: "D", analysis: "推理判断题。A/B/C均在第4段提到。D项（与人类更好交流）未提及。注意题目要求选NOT mentioned。", tag: "阅读·推理判断" },
          ],
        },
      ],
      separator: true,
    },

    // ============================================================
    // 五、书面表达（15分）
    // ============================================================
    {
      title: "五、书面表达（满分15分）",
      instruction: "参照北京市初一年级期末书面表达真题风格命制——提纲作文，给出3-4个要点提示，词数70-90词。",
      summary: [
        "书面表达评分维度：内容完整(5分)+语言准确(5分)+结构清晰(3分)+书写规范(2分)=15分。",
        "高分技巧：①开头直接回答问题，不绕弯；②中间每点写2-3句，用连接词(First/Also/What's more)串联；③结尾点题升华；④避免全文简单句，穿插一两句复合句。",
        "常见失分点：时态不一致、三单忘+s、名词单复数错误、拼写粗心。写完后务必检查。",
      ],
      items: [
        {
          type: "writing",
          title: "题目：My School Life",
          prompts: [
            { num: 1, text: "What do you usually do at school? (subjects, activities, friends...)" },
            { num: 2, text: "What is your favorite subject and why? (at least one reason)" },
            { num: 3, text: "What after-school activities do you take part in?" },
            { num: 4, text: "How do you feel about your school life and why?" },
          ],
          wordCount: "70-90词（不少于8句话）",
          lines: 10,
          sample: [
            "My name is Nandy. I'm a Grade 6 student at Huoying Primary School. I usually have six classes every day from Monday to Friday.",
            "",
            "My favorite subject is English because I think it's very useful and interesting. Our English teacher always makes the class fun. We often play games and sing English songs together.",
            "",
            "After school, I enjoy reading storybooks in the library and playing badminton with my best friends on the playground. Sometimes I join the school art club, where I can draw and paint.",
            "",
            "I really love my school life. It is busy but full of happiness. I've learned a lot and made many good friends here!",
          ],
          rubric: [
            "【内容完整 5分】是否覆盖全部4个要点，每缺一个要点扣1-2分。",
            "【语言准确 5分】语法/拼写/标点是否正确，每处错误扣0.5分，重复错误不累计。重点关注：时态一致性、三单、名词复数。",
            "【结构清晰 3分】是否有开头-主体-结尾，是否正确使用连接词(First/Also/What's more/等)。",
            "【书写规范 2分】字迹工整、格式规范、无大面积涂改。",
          ],
          // ====== 4篇拓展范文（仅出现在答案解析版） ======
          extraEssays: [
            // ---- 拓展1：人物描写类 ----
            {
              title: "My Best Friend",
              category: "人物描写类",
              wordCount: "70-90词",
              prompts: [
                { num: 1, text: "Who is your best friend? (name, age, appearance)" },
                { num: 2, text: "How did you become friends?" },
                { num: 3, text: "What do you usually do together?" },
                { num: 4, text: "Why is he/she your best friend?" },
              ],
              sample: [
                "My best friend is Li Ming. He is twelve years old. He is tall and thin with short black hair and bright eyes. He always wears a warm smile.",
                "",
                "We became friends two years ago. One day I forgot my lunch, and Li Ming kindly shared his food with me. Since then, we have been best friends.",
                "",
                "We often play basketball together after school. On weekends, we go to the library or ride bikes in the park. He is very good at math and always helps me with difficult problems.",
                "",
                "Li Ming is my best friend because he is kind and always there for me. A true friend is hard to find, and I'm really lucky to have him in my life!",
              ],
            },
            // ---- 拓展2：叙事记事类 ----
            {
              title: "An Unforgettable Day",
              category: "叙事记事类",
              wordCount: "70-90词",
              prompts: [
                { num: 1, text: "What happened and when?" },
                { num: 2, text: "Who were you with?" },
                { num: 3, text: "What did you do?" },
                { num: 4, text: "Why was it unforgettable?" },
              ],
              sample: [
                "Last Saturday was an unforgettable day. It was my grandmother's 70th birthday.",
                "",
                "In the morning, my parents and I went to Grandma's house with a big cake and flowers. All my uncles, aunts, and cousins came too. We prepared a big dinner together. I made a birthday card with my own drawings for Grandma.",
                "",
                "In the evening, we sang \"Happy Birthday\" and enjoyed the delicious food. Grandma was so happy that she had tears in her eyes. She said it was the best birthday ever.",
                "",
                "This day was unforgettable because I learned how important family is. Seeing Grandma's happy smile made my heart feel warm. I will always remember this special day!",
              ],
            },
            // ---- 拓展3：计划未来类 ----
            {
              title: "My Summer Holiday Plan",
              category: "计划未来类",
              wordCount: "70-90词",
              prompts: [
                { num: 1, text: "When does your summer holiday start?" },
                { num: 2, text: "What are you going to do? (at least two plans)" },
                { num: 3, text: "Who are you going to spend time with?" },
                { num: 4, text: "How do you feel about the coming holiday?" },
              ],
              sample: [
                "The summer holiday is coming soon, and I'm really excited! I have made a great plan.",
                "",
                "First, I'm going to finish all my homework in the first two weeks. Second, I plan to read at least five English storybooks to improve my reading. My parents also promised to take me to the seaside for three days — I can't wait to swim in the sea!",
                "",
                "I will also spend more time with my grandparents in the countryside. I'm going to help them water the vegetables and play chess with my grandpa. The fresh air and green fields always make me feel happy.",
                "",
                "I think this summer holiday will be both relaxing and meaningful. I really can't wait for it to begin!",
              ],
            },
            // ---- 拓展4：兴趣爱好类 ----
            {
              title: "My Hobby",
              category: "兴趣爱好类",
              wordCount: "70-90词",
              prompts: [
                { num: 1, text: "What is your hobby?" },
                { num: 2, text: "When and how did you start it?" },
                { num: 3, text: "How often do you practice it?" },
                { num: 4, text: "Why do you enjoy this hobby?" },
              ],
              sample: [
                "My hobby is drawing. I started it when I was only five years old. My mother bought me a box of colored pencils, and I fell in love with them right away.",
                "",
                "I draw almost every day after finishing my homework. I like to draw animals, flowers, and cartoon characters. Last year, I joined the school art club. There, I learn new skills and draw with friends who share the same interest.",
                "",
                "Drawing makes me feel calm and happy. When I draw, I forget all my worries. It also helps me notice beautiful colors and shapes in everyday life. My dream is to become an artist one day.",
                "",
                "Hobbies make our lives more colorful and interesting. Drawing has brought so much joy to my life, and I will never give it up!",
              ],
            },
          ],
        },
      ],
    },
  ],
};

// ====== 生成 Word 文档 ======
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
