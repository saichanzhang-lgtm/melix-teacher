const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType, PageBreak } = require("docx");
const fs = require("fs");
const path = require("path");

// ========================
// 工具函数
// ========================

function heading(text, level = 1) {
  return new Paragraph({ text, heading: `Heading${level}`, spacing: { before: 300, after: 150 } });
}

function p(text, options = {}) {
  return new Paragraph({
    children: [new TextRun({ text, ...options })],
    spacing: { before: 80, after: 80 },
  });
}

function pBold(text) { return p(text, { bold: true }); }

function pAnswer(text) {
  return new Paragraph({
    children: [new TextRun({ text, color: "C00000", bold: true, size: 22 })],
    spacing: { before: 60, after: 60 },
  });
}

function emptyLine(n = 1) {
  return Array(n).fill(null).map(() => new Paragraph({ spacing: { before: 60, after: 60 } }));
}

function infoLine(text) {
  return new Paragraph({
    children: [new TextRun({ text, italics: true, size: 20, color: "555555" })],
    spacing: { before: 40, after: 40 },
  });
}

function choiceItem(num, stem, options, indent = false) {
  const prefix = indent ? "    " : "";
  const lines = [
    new Paragraph({
      children: [new TextRun({ text: `${prefix}(${num}) ${stem}`, bold: false, size: 21 })],
      spacing: { before: 120, after: 40 },
    }),
  ];
  options.forEach(opt => {
    lines.push(new Paragraph({
      children: [new TextRun({ text: `${prefix}    ${opt}`, size: 21 })],
      spacing: { before: 20, after: 20 },
    }));
  });
  return lines;
}

// 四选项同行（试卷标准格式）
function inlineChoiceItem(num, stem, options) {
  const optionText = options.join("    ");
  return [
    new Paragraph({
      children: [new TextRun({ text: `(   ) ${num}. ${stem}`, bold: false, size: 21 })],
      spacing: { before: 150, after: 40 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `    ${optionText}`, size: 21 })],
      spacing: { before: 20, after: 20 },
    }),
  ];
}

function inlineChoiceAnswer(num, answer, analysis, tag) {
  return [
    new Paragraph({
      children: [
        new TextRun({ text: `${num}. `, bold: true, size: 21 }),
        new TextRun({ text: answer, bold: true, color: "C00000", size: 21 }),
        new TextRun({ text: `  |  ${tag}  |  ${analysis}`, size: 20, color: "555555" }),
      ],
      spacing: { before: 80, after: 80 },
    }),
  ];
}

function choiceItemAnswer(num, answer, analysis, tag) {
  return [
    new Paragraph({
      children: [
        new TextRun({ text: `(${num}) `, bold: true, size: 21 }),
        new TextRun({ text: answer, bold: true, color: "C00000", size: 21 }),
        new TextRun({ text: `  |  ${tag}  |  ${analysis}`, size: 20, color: "555555" }),
      ],
      spacing: { before: 80, after: 80 },
    }),
  ];
}

function blankLine(num, stem) {
  return new Paragraph({
    children: [new TextRun({ text: `${num}. ${stem}`, size: 21 })],
    spacing: { before: 100, after: 60 },
  });
}

function blankAnswer(num, answer, tag) {
  return new Paragraph({
    children: [
      new TextRun({ text: `${num}. `, bold: true, size: 21 }),
      new TextRun({ text: answer, bold: true, color: "C00000", size: 21 }),
      new TextRun({ text: `  [${tag}]`, size: 20, color: "888888" }),
    ],
    spacing: { before: 50, after: 50 },
  });
}

// ========================
// 构建试卷
// ========================

async function generateExam(examData, outputDir) {
  const { title, subtitle, meta, sections } = examData;

  // ===== 题目版 =====
  const questionDoc = new Document({
    sections: [
      {
        properties: {
          page: { margin: { top: 1000, bottom: 1000, left: 1200, right: 1200 } },
        },
        children: [
          heading(title, 0),
          infoLine(subtitle),
          ...meta.map(m => infoLine(m)),
          new Paragraph({ spacing: { before: 200 } }),

          ...sections.flatMap(sec => {
            const children = [];
            children.push(heading(sec.title, 2));
            if (sec.instruction) children.push(infoLine(sec.instruction));

            sec.items.forEach(item => {
              switch (item.type) {
                case "choice":
                  children.push(...choiceItem(item.num, item.stem, item.options, item.indent));
                  break;
                case "inlineChoice":
                  children.push(...inlineChoiceItem(item.num, item.stem, item.options));
                  break;
                case "wordbank":
                  // 方框词库
                  children.push(pBold("方框中的单词："));
                  children.push(new Paragraph({
                    children: [new TextRun({ text: item.wordBank.join("    "), bold: true, size: 22 })],
                    spacing: { before: 40, after: 120 },
                    border: { top: { style: BorderStyle.SINGLE, size: 1 }, bottom: { style: BorderStyle.SINGLE, size: 1 }, left: { style: BorderStyle.SINGLE, size: 1 }, right: { style: BorderStyle.SINGLE, size: 1 } },
                  }));
                  // 短文含空
                  if (item.passage) {
                    item.passage.forEach(line => children.push(p(line, { size: 21 })));
                  }
                  break;
                case "blank":
                  children.push(blankLine(item.num, item.stem));
                  if (item.extraLines) {
                    item.extraLines.forEach(l => children.push(p(l)));
                  }
                  break;
                case "reading":
                  children.push(pBold(item.title || `(${item.label})`));
                  if (item.passage) {
                    item.passage.forEach(line => children.push(p(line, { size: 20 })));
                  }
                  children.push(...emptyLine(1));
                  item.questions.forEach(q => {
                    children.push(...choiceItem(q.num, q.stem, q.options, true));
                  });
                  break;
                case "cloze":
                  if (item.passage) {
                    item.passage.forEach(line => children.push(p(line, { size: 21 })));
                  }
                  children.push(...emptyLine(1));
                  item.blanks.forEach(b => {
                    children.push(...choiceItem(b.num, b.stem, b.options));
                  });
                  break;
                case "writing":
                  children.push(pBold(item.title));
                  if (item.prompts) {
                    item.prompts.forEach(pr => children.push(p(`${pr.num}. ${pr.text}`)));
                  }
                  children.push(p(`词数要求：${item.wordCount}`));
                  if (item.lines) {
                    children.push(...Array(item.lines).fill(null).map(() => p("________________________________________________")));
                  }
                  break;
                case "section_title":
                  children.push(heading(item.text, 3));
                  break;
              }
            });

            if (sec.separator) children.push(new Paragraph({ spacing: { before: 300 } }));
            return children;
          }),
        ],
      },
    ],
  });

  const questionBuffer = await Packer.toBuffer(questionDoc);
  const questionPath = path.join(outputDir, `${examData.filePrefix}-题目版.docx`);
  fs.writeFileSync(questionPath, questionBuffer);
  console.log(`题目版已生成: ${questionPath}`);

  // ===== 答案版 =====
  const answerChildren = [
    heading(`${title} — 答案解析`, 0),
    infoLine(subtitle),
    ...meta.map(m => infoLine(m)),
    new Paragraph({ spacing: { before: 200 } }),
  ];

  sections.forEach(sec => {
    answerChildren.push(heading(sec.title, 2));

    sec.items.forEach(item => {
      switch (item.type) {
        case "choice":
          if (item.answer) {
            answerChildren.push(...choiceItemAnswer(item.num, item.answer, item.analysis || "", item.tag || ""));
          }
          break;
        case "inlineChoice":
          if (item.answer) {
            answerChildren.push(...inlineChoiceAnswer(item.num, item.answer, item.analysis || "", item.tag || ""));
          }
          break;
        case "wordbank":
          answerChildren.push(pBold("选词填空 · 答案"));
          if (item.answers) {
            item.answers.forEach(a => {
              answerChildren.push(blankAnswer(a.num, a.answer, a.tag || ""));
            });
          }
          break;
        case "blank":
          if (item.answer) {
            answerChildren.push(blankAnswer(item.num, item.answer, item.tag || ""));
          }
          break;
        case "reading":
          answerChildren.push(pBold(item.title || item.label));
          item.questions.forEach(q => {
            if (q.answer) {
              answerChildren.push(...choiceItemAnswer(q.num, q.answer, q.analysis || "", q.tag || ""));
            }
          });
          break;
        case "cloze":
          answerChildren.push(pBold("完形填空答案"));
          item.blanks.forEach(b => {
            if (b.answer) {
              answerChildren.push(...choiceItemAnswer(b.num, b.answer, b.analysis || "", b.tag || ""));
            }
          });
          break;
        case "writing":
          answerChildren.push(pBold("【题目】" + (item.title || "")));
          answerChildren.push(pBold("【参考范文】"));
          if (item.sample) {
            item.sample.forEach(line => answerChildren.push(p(line)));
          }
          answerChildren.push(pBold("【评分标准】"));
          if (item.rubric) {
            item.rubric.forEach(r => answerChildren.push(p(r)));
          }
          // 额外范文（仅出现在答案版）
          if (item.extraEssays) {
            answerChildren.push(new Paragraph({ spacing: { before: 400 } }));
            answerChildren.push(heading("📚 常考作文主题拓展（共5大主题，基本覆盖分班考全部作文方向）", 2));
            item.extraEssays.forEach((essay, idx) => {
              answerChildren.push(pBold(`拓展 ${idx + 1}：${essay.title}【${essay.category}】`));
              if (essay.prompts) {
                essay.prompts.forEach(pr => answerChildren.push(p(`${pr.num}. ${pr.text}`, { size: 20 })));
              }
              answerChildren.push(p(`词数要求：${essay.wordCount || "70-90词"}`, { size: 20, italics: true }));
              answerChildren.push(pBold("范文："));
              if (essay.sample) {
                essay.sample.forEach(line => answerChildren.push(p(line)));
              }
              answerChildren.push(...emptyLine(1));
            });
          }
          break;
      }
    });

    // 添加该部分的知识点小结
    if (sec.summary) {
      answerChildren.push(pBold("📌 本节考点小结"));
      sec.summary.forEach(s => answerChildren.push(p(s)));
    }
  });

  const answerDoc = new Document({
    sections: [{
      properties: { page: { margin: { top: 1000, bottom: 1000, left: 1200, right: 1200 } } },
      children: answerChildren,
    }],
  });

  const answerBuffer = await Packer.toBuffer(answerDoc);
  const answerPath = path.join(outputDir, `${examData.filePrefix}-答案解析版.docx`);
  fs.writeFileSync(answerPath, answerBuffer);
  console.log(`答案版已生成: ${answerPath}`);

  return { questionPath, answerPath };
}

module.exports = { generateExam };
