请实现editorjs-wavedrom工具，该工具是一个editor.js的工具插件，基于https://github.com/wavedrom/wavedrom

该工具在界面上分为上下两部分。上部分是波形图。下部分是波形图代码输入框。代码输入框中使用WaveJSON实现代码输入。

在wavedrom的git页面，有Web usage章节，请参考。另外，这里涉及到使用CDN，请考虑本地化方式
（例如存储到本项目的/dist ? 或者不存储在编译的时候直接能编译到项目输出文件内？)

关于editor-js的工具范本，可以参考一个最简工程PlugIns/quote

关于代码输入框，如果能使用类似editorjs-codeflask所使用的语言框，则更好。如果那个语言框过重，也可以使用更轻量级的实现。请自行考虑。

