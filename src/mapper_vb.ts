"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
import * as fs from 'fs';

const use_standard_indent = false; // False = don't indent declarations inside of functions/subs. True = indent the declarations inside functions/subs.
const standard_indent = 2; // Set based on indenting standards used in files. Only used if use_standard_indent is true

// Used when combining parameters defined across multiple lines
interface multi_line {
  text: string;
  end: number;
}


class mapper {

  static read_all_lines(file: string): string[] {
    let text = fs.readFileSync(file, "utf8");
    return text.split(/\r?\n/g);
  }

  //Handles situations where parameters are on multiple lines
  static grab_signature(lines: string[], start: number): multi_line {
  
    let buf = lines[start] ?? "";
    let depth = 0;

    // Remove trailing continuation on the start line
    buf = buf.replace(/[ \t]*_[ \t]*$/g, "");

    // Initialize depth from first "(" onward (if any)
    let firstParen = buf.indexOf("(");

    if (firstParen >= 0) {
      for (let ch of buf.slice(firstParen)) {
        if (ch === "(") depth++;
        else if (ch === ")") depth--;
      }
    }

    let i = start;

    // Consume subsequent lines until balanced or EOF
    while (depth > 0 && i + 1 < lines.length) {
      i++;
      let seg = (lines[i] ?? "").replace(/[ \t]*_[ \t]*$/g, "");
      buf += "\n" + seg;

      for (let ch of seg) {
        if (ch === "(") depth++;
        else if (ch === ")") depth--;
      }
    }
    return { text: buf, end: i } as { text: string; end: number };
  }
 
  static to_display_text(text: string): string {
    let first_line = text.split(/\r?\n/, 1)[0]
    let indent_level = first_line.length - first_line.trimStart().length;

    let cleaned = text
      .replace(/\r?\n\s*/g, " ") // ALWAYS: collapse embedded new lines
      .replace(/'[^\n]*$/gm, "") // ALWAYS: strip VB end-of-line comments
      .replace(/(\b(?:Const|Dim)\b[^=]*?)=\s*.*$/gm, "$1") // ALWAYS: never show initializer values on Const/Dim
      .replace(/\([^)]*\)/g, "()") // TOGGLE: hide parameters inside (...) ; comment out to SHOW
      .replace(/\)\s+[Aa]s\b[^\n]*$/gm, ")") // TOGGLE: hide function RETURN type only (") As ..."); comment out to SHOW
      .replace(/(\b(?:Dim|Const)\b[^\n]*?)\s+[Aa]s\b[^\n]*$/gm, "$1") // TOGGLE: hide variable/const trailing " As Type"; comment out to SHOW
      .trimStart(); // ALWAYS: trim leading spaces      

    return " ".repeat(indent_level) + cleaned;
  }

  static generate(file: string): string[] {
    let members = [];
    let inProc = false;

    try {
      let lines = mapper.read_all_lines(file);
      let cursorSkip = -1; // index up to which we skip because it was consumed

      lines.forEach((line, idx) => {

        // Respect the skip cursor if prior aggregation consumed lines
        if (idx <= cursorSkip) return;

        let line_num = idx + 1;
        let code_line = (line ?? "").trimStart();

        // Skip full-line comments
        if (code_line.startsWith("'")) return;

        // Resets flag to show out of procedure 
        if(/[Ee]nd ([Ff]unction|[Ss]ub)/.test(line)){
            inProc = false;
            return;
        }

        if (/[Cc]lass /.test(line)) {
          let display_text = mapper.to_display_text(line);
          members.push(`${display_text}|${line_num}|class`);
          return;
        }

        if (/([Ff]unction|[Ss]ub) /.test(line)) {
          // Handles multiple lines in parameter declaration
          let { text, end } = mapper.grab_signature(lines, idx);
          let display_text = mapper.to_display_text(text);
          members.push(`${display_text}|${line_num}|function`);
          cursorSkip = end; // Skip the consumed continuation lines
          inProc = true;
          return;
        }

        if (/([Dd]im|[Cc]onst) /.test(line)) {
          let display_text = mapper.to_display_text(line);
          let current_indent = display_text.match(/^ */)[0].length;
          let proc_indent = "";

          // Sets indent based on flag and current indent level
          if(use_standard_indent){
            if(inProc && current_indent == 0) proc_indent = " ".repeat(standard_indent);
          }
          else{
            proc_indent = " ".repeat(current_indent);            
          }

          members.push(`${proc_indent}${display_text}|${line_num}|field`);
          return;
        }
      });
    } catch (error) {
    }

    return members;
  }
}

exports.mapper = mapper;