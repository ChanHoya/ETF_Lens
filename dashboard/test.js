const ts = require('typescript');
const program = ts.createProgram(['src/app/page.tsx'], { jsx: ts.JsxEmit.Preserve });
const diagnostics = ts.getPreEmitDiagnostics(program);
diagnostics.forEach(d => {
  if (d.file) {
    let { line, character } = ts.getLineAndCharacterOfPosition(d.file, d.start);
    console.log(`Error ${d.file.fileName} (${line + 1},${character + 1}): ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`);
  }
});
