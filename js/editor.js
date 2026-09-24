/* ============================================
   1991 Academy — Code editor
   Dependency-free editor with syntax highlight
   (overlay technique), line numbers, LeetCode-
   style auto-closing pairs and smart indent.
   ============================================ */

const CodeEditor = (() => {
  /* ---------- tokenizers ---------- */

  const RULES = {
    javascript: {
      regex: new RegExp(
        [
          "(\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/)", // comment
          "(\"(?:[^\"\\\\\\n]|\\\\.)*\"|'(?:[^'\\\\\\n]|\\\\.)*'|`(?:[^`\\\\]|\\\\.)*`)", // string
          "\\b(\\d+(?:\\.\\d+)?(?:e[+-]?\\d+)?)\\b", // number
          "\\b(function|const|let|var|return|if|else|for|while|do|new|class|extends|typeof|instanceof|in|of|break|continue|switch|case|default|try|catch|finally|throw|this|true|false|null|undefined|async|await|yield|delete|void)\\b", // keyword
          "([A-Za-z_$][\\w$]*)(?=\\s*\\()", // function call
        ].join("|"),
        "g"
      ),
      indentUnit: "  ",
      openIndent: /[{([]\s*$/,
    },
    python: {
      regex: new RegExp(
        [
          "(#[^\\n]*)", // comment
          "(\"\"\"[\\s\\S]*?\"\"\"|'''[\\s\\S]*?'''|\"(?:[^\"\\\\\\n]|\\\\.)*\"|'(?:[^'\\\\\\n]|\\\\.)*')", // string
          "\\b(\\d+(?:\\.\\d+)?(?:e[+-]?\\d+)?)\\b", // number
          "\\b(def|return|if|elif|else|for|while|in|not|and|or|None|True|False|class|import|from|as|lambda|pass|break|continue|try|except|finally|raise|with|global|yield|is|del)\\b", // keyword
          "([A-Za-z_][\\w]*)(?=\\s*\\()", // function call
        ].join("|"),
        "g"
      ),
      indentUnit: "    ",
      openIndent: /(:\s*$)|([{([]\s*$)/,
    },
    cpp: {
      regex: new RegExp(
        [
          "(\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/|#[^\\n]*)", // comment / preprocessor
          "(\"(?:[^\"\\\\\\n]|\\\\.)*\"|'(?:[^'\\\\\\n]|\\\\.)*')", // string / char
          "\\b(\\d+(?:\\.\\d+)?(?:e[+-]?\\d+)?f?)\\b", // number
          "\\b(int|long|short|char|bool|float|double|void|auto|const|unsigned|signed|struct|class|public|private|protected|template|typename|namespace|using|return|if|else|for|while|do|switch|case|default|break|continue|new|delete|true|false|nullptr|sizeof|static|virtual|override|this|vector|string|map|set|pair|queue|stack|size_t)\\b", // keyword / STL
          "([A-Za-z_][\\w]*)(?=\\s*\\()", // function call
        ].join("|"),
        "g"
      ),
      indentUnit: "    ",
      openIndent: /[{([]\s*$/,
    },
  };

  const EXT = { python: ".py", cpp: ".cpp", javascript: ".js" };

  const TK = ["tk-com", "tk-str", "tk-num", "tk-kw", "tk-fn"];

  function escHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function highlight(code, lang) {
    const rule = RULES[lang] || RULES.javascript;
    let out = "";
    let last = 0;
    code.replace(rule.regex, (...args) => {
      const match = args[0];
      const offset = args[args.length - 2];
      const groups = args.slice(1, 1 + TK.length);
      out += escHtml(code.slice(last, offset));
      const cls = TK[groups.findIndex((g) => g !== undefined)];
      out += '<span class="' + cls + '">' + escHtml(match) + "</span>";
      last = offset + match.length;
      return match;
    });
    out += escHtml(code.slice(last));
    return out + "\n"; /* trailing newline keeps the last line rendered */
  }

  /* ---------- editing helpers ---------- */

  const PAIRS = { "(": ")", "[": "]", "{": "}", '"': '"', "'": "'", "`": "`" };
  const CLOSERS = new Set(Object.values(PAIRS));

  function insertText(ta, text) {
    /* execCommand keeps native undo history alive */
    ta.focus();
    let ok = false;
    try {
      ok = document.execCommand("insertText", false, text);
    } catch {
      ok = false;
    }
    if (!ok) {
      ta.setRangeText(text, ta.selectionStart, ta.selectionEnd, "end");
      ta.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  function deleteRange(ta, from, to) {
    ta.focus();
    ta.setSelectionRange(from, to);
    let ok = false;
    try {
      ok = document.execCommand("delete", false);
    } catch {
      ok = false;
    }
    if (!ok) {
      ta.setRangeText("", from, to, "end");
      ta.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  /* ---------- component ---------- */

  function create(host, opts) {
    let lang = opts.language || "javascript";
    let filename = opts.filename || "solution";
    const langs = opts.languages || [{ id: "javascript", label: "JavaScript" }];

    host.innerHTML =
      '<div class="ced">' +
      '<div class="ced-head">' +
      '<span class="ced-dot" style="background:#ff5f57"></span>' +
      '<span class="ced-dot" style="background:#febc2e"></span>' +
      '<span class="ced-dot" style="background:#28c840"></span>' +
      '<span class="ced-title"></span>' +
      '<select class="ced-lang" aria-label="Language"' + (langs.length < 2 ? " hidden" : "") + ">" +
      langs
        .map((l) => '<option value="' + l.id + '"' + (l.disabled ? " disabled" : "") + ">" + l.label + "</option>")
        .join("") +
      "</select></div>" +
      '<div class="ced-body">' +
      '<div class="ced-gutter"><pre class="ced-lines">1</pre></div>' +
      '<div class="ced-main">' +
      '<div class="ced-hl-wrap"><pre class="ced-hl" aria-hidden="true"></pre></div>' +
      '<textarea class="ced-input" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" wrap="off" aria-label="Code editor"></textarea>' +
      "</div></div></div>";

    const ta = host.querySelector(".ced-input");
    const hl = host.querySelector(".ced-hl");
    const hlWrap = host.querySelector(".ced-hl-wrap");
    const gutter = host.querySelector(".ced-gutter");
    const linesEl = host.querySelector(".ced-lines");
    const titleEl = host.querySelector(".ced-title");
    const langSel = host.querySelector(".ced-lang");

    function render() {
      hl.innerHTML = highlight(ta.value, lang);
      const n = ta.value.split("\n").length;
      linesEl.textContent = Array.from({ length: n }, (_, i) => i + 1).join("\n");
      titleEl.textContent = filename + (EXT[lang] || ".txt");
    }

    function sync() {
      hlWrap.scrollTop = ta.scrollTop;
      hlWrap.scrollLeft = ta.scrollLeft;
      gutter.scrollTop = ta.scrollTop;
      hl.style.transform = "translate(" + -ta.scrollLeft + "px," + -ta.scrollTop + "px)";
      linesEl.style.transform = "translateY(" + -ta.scrollTop + "px)";
    }

    ta.addEventListener("input", () => {
      render();
      sync();
      if (opts.onChange) opts.onChange(ta.value);
    });
    ta.addEventListener("scroll", sync);

    /* --- the LeetCode feel: pairs, type-over, smart enter/tab --- */
    ta.addEventListener("keydown", (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const start = ta.selectionStart, end = ta.selectionEnd;
      const val = ta.value;
      const next = val[end] || "";
      const prev = val[start - 1] || "";
      const unit = (RULES[lang] || RULES.javascript).indentUnit;

      /* type-over an existing closer:  )|  + ")"  → skip */
      if (CLOSERS.has(e.key) && start === end && next === e.key && !(e.key in PAIRS)) {
        e.preventDefault();
        ta.setSelectionRange(start + 1, start + 1);
        return;
      }

      if (e.key in PAIRS) {
        const close = PAIRS[e.key];
        /* quotes: type over an identical one */
        if (e.key === close && start === end && next === e.key) {
          e.preventDefault();
          ta.setSelectionRange(start + 1, start + 1);
          return;
        }
        /* don't auto-pair a quote right after a word character (don't, it's) */
        if (e.key === close && start === end && /[\w"'`]/.test(prev)) return;
        e.preventDefault();
        if (start !== end) {
          /* wrap the selection */
          const inner = val.slice(start, end);
          insertText(ta, e.key + inner + close);
          ta.setSelectionRange(start + 1, start + 1 + inner.length);
        } else {
          insertText(ta, e.key + close);
          ta.setSelectionRange(start + 1, start + 1);
        }
        return;
      }

      if (e.key === "Backspace" && start === end && PAIRS[prev] && next === PAIRS[prev]) {
        e.preventDefault();
        deleteRange(ta, start - 1, start + 1);
        return;
      }

      if (e.key === "Enter" && start === end) {
        const lineStart = val.lastIndexOf("\n", start - 1) + 1;
        const line = val.slice(lineStart, start);
        const indent = (line.match(/^\s*/) || [""])[0];
        const opens = (RULES[lang] || RULES.javascript).openIndent.test(line);
        e.preventDefault();
        if ((prev === "{" || prev === "(" || prev === "[") && next === PAIRS[prev]) {
          /* cursor between a fresh pair: open a padded block */
          insertText(ta, "\n" + indent + unit + "\n" + indent);
          ta.setSelectionRange(start + 1 + indent.length + unit.length, start + 1 + indent.length + unit.length);
        } else {
          insertText(ta, "\n" + indent + (opens ? unit : ""));
        }
        return;
      }

      if (e.key === "Tab") {
        e.preventDefault();
        if (start !== end && val.slice(start, end).includes("\n")) {
          /* (de)indent every selected line */
          const from = val.lastIndexOf("\n", start - 1) + 1;
          const block = val.slice(from, end);
          const lines = block.split("\n");
          const edited = lines
            .map((l) => (e.shiftKey ? l.replace(new RegExp("^(" + unit + "|\\t| {1," + unit.length + "})"), "") : unit + l))
            .join("\n");
          ta.setSelectionRange(from, end);
          insertText(ta, edited);
          ta.setSelectionRange(from, from + edited.length);
        } else if (e.shiftKey) {
          const lineStart = val.lastIndexOf("\n", start - 1) + 1;
          if (val.startsWith(unit, lineStart)) {
            deleteRange(ta, lineStart, lineStart + unit.length);
            ta.setSelectionRange(Math.max(lineStart, start - unit.length), Math.max(lineStart, start - unit.length));
          }
        } else {
          insertText(ta, unit);
        }
        return;
      }
    });

    if (langSel) {
      langSel.value = lang;
      langSel.addEventListener("change", () => {
        if (opts.onLanguageChange) opts.onLanguageChange(langSel.value);
      });
    }

    ta.value = opts.value || "";
    render();

    return {
      getValue: () => ta.value,
      setValue(v) {
        ta.value = v;
        render();
        sync();
      },
      getLanguage: () => lang,
      setLanguage(l) {
        lang = l;
        if (langSel) langSel.value = l;
        render();
      },
      setFilename(name) {
        filename = name || "solution";
        render();
      },
      focus: () => ta.focus(),
    };
  }

  return { create, highlight };
})();
