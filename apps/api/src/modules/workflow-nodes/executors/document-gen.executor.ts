/**
 * Document Generation Executor
 *
 * Generates real downloadable documents from analysis results:
 *   - DOCX (Word) — via docx library
 *   - PDF — via pdfkit
 *   - HTML — direct generation
 *   - CSV/JSON — data export
 *   - Markdown — text format
 *
 * Registers as connector: metis-document-gen
 */
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import {
  INodeExecutor,
  NodeExecutionInput,
  NodeExecutionOutput,
  ConnectorMetadata,
  NodeExecutorRegistry,
  GeneratedFile,
} from '../node-executor-registry';

@Injectable()
export class DocumentGenExecutor implements OnModuleInit, INodeExecutor {
  readonly executorKey = 'document-gen';
  readonly displayName = '문서 생성 / 파일 내보내기';
  readonly handledNodeTypes = ['file-operation'];
  readonly handledCategories = ['output'];

  private readonly logger = new Logger(DocumentGenExecutor.name);
  private outputDir: string;

  constructor(
    private readonly registry: NodeExecutorRegistry,
    private readonly config: ConfigService,
  ) {
    this.outputDir = this.config.get('OUTPUT_DIR') || '/tmp/metis-outputs';
  }

  onModuleInit() {
    this.registry.register(this);
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  async execute(input: NodeExecutionInput): Promise<NodeExecutionOutput> {
    const start = Date.now();
    const settings = input.settings;
    const format = settings.outputFormat || 'docx';
    const content = input.previousOutput;

    if (!content || content.length < 10) {
      return {
        success: false,
        data: {},
        outputText: '',
        durationMs: Date.now() - start,
        error: '문서에 포함할 내용이 없습니다. 이전 노드의 결과를 확인하세요.',
      };
    }

    try {
      const sessionDir = path.join(this.outputDir, input.executionSessionId);
      if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
      }

      // Build filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const baseName = settings.fileNamePattern
        ? settings.fileNamePattern
            .replace('{{date}}', timestamp.slice(0, 10))
            .replace('{{time}}', timestamp.slice(11))
            .replace('{{project}}', 'metis')
        : `report-${timestamp}`;

      let generatedFile: GeneratedFile;

      switch (format) {
        case 'docx':
          generatedFile = await this.generateDocx(content, baseName, sessionDir, settings);
          break;
        case 'pdf':
          generatedFile = await this.generatePdf(content, baseName, sessionDir, settings);
          break;
        case 'html':
          generatedFile = await this.generateHtml(content, baseName, sessionDir, settings);
          break;
        case 'csv':
          generatedFile = await this.generateCsv(content, baseName, sessionDir);
          break;
        case 'json':
          generatedFile = await this.generateJson(content, baseName, sessionDir);
          break;
        case 'md':
        default:
          generatedFile = await this.generateMarkdown(content, baseName, sessionDir);
          break;
      }

      return {
        success: true,
        data: {
          format,
          fileName: generatedFile.name,
          filePath: generatedFile.path,
          fileSize: generatedFile.size,
          downloadUrl: generatedFile.downloadUrl,
        },
        outputText: `문서 생성 완료: ${generatedFile.name} (${(generatedFile.size / 1024).toFixed(1)}KB)\n다운로드: ${generatedFile.downloadUrl}`,
        generatedFiles: [generatedFile],
        durationMs: Date.now() - start,
      };
    } catch (err) {
      return {
        success: false,
        data: {},
        outputText: '',
        durationMs: Date.now() - start,
        error: `문서 생성 실패: ${(err as Error).message}`,
      };
    }
  }

  /**
   * Generate DOCX (Word) document
   * Uses a simple XML-based approach without heavy dependencies
   */
  private async generateDocx(
    content: string,
    baseName: string,
    outputDir: string,
    settings: Record<string, any>,
  ): Promise<GeneratedFile> {
    const fileName = `${baseName}.docx`;
    const filePath = path.join(outputDir, fileName);

    // Try to use docx npm package if available, otherwise generate simple OOXML
    try {
      const docx = require('docx');
      const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = docx;

      const sections = this.parseContentToSections(content);
      const children: any[] = [];

      // Title
      children.push(
        new Paragraph({
          text: settings.reportTitle || 'Metis.AI 분석 보고서',
          heading: HeadingLevel.TITLE,
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({
          text: `생성일시: ${new Date().toLocaleString('ko-KR')}`,
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
        }),
      );

      // Content sections
      for (const section of sections) {
        if (section.type === 'heading') {
          children.push(new Paragraph({
            text: section.text,
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 100 },
          }));
        } else {
          // Split into paragraphs
          for (const line of section.text.split('\n')) {
            if (line.trim()) {
              children.push(new Paragraph({
                children: [new TextRun({ text: line, size: 22 })],
                spacing: { after: 80 },
              }));
            }
          }
        }
      }

      const doc = new Document({
        sections: [{
          properties: {},
          children,
        }],
      });

      const buffer = await Packer.toBuffer(doc);
      fs.writeFileSync(filePath, buffer);
    } catch {
      // Fallback: generate as RTF-like text file with .docx extension
      // In production, the docx package would be installed
      this.logger.warn('docx package not available, generating text fallback');
      const fallbackContent = this.formatAsText(content, settings);
      fs.writeFileSync(filePath.replace('.docx', '.txt'), fallbackContent);
      // Also generate HTML version which Word can open
      const htmlFile = await this.generateHtml(content, baseName, outputDir, settings);
      return { ...htmlFile, format: 'html' };
    }

    const stat = fs.statSync(filePath);
    return {
      name: fileName,
      path: filePath,
      format: 'docx',
      size: stat.size,
      downloadUrl: `/api/workflow-nodes/download/${path.basename(outputDir)}/${fileName}`,
    };
  }

  /**
   * Generate PDF document
   */
  private async generatePdf(
    content: string,
    baseName: string,
    outputDir: string,
    settings: Record<string, any>,
  ): Promise<GeneratedFile> {
    const fileName = `${baseName}.pdf`;
    const filePath = path.join(outputDir, fileName);

    try {
      const PDFDocument = require('pdfkit');
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 72, right: 72 },
        info: {
          Title: settings.reportTitle || 'Metis.AI Report',
          Author: 'Metis.AI',
          Creator: 'Metis.AI Workflow Engine',
        },
      });

      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // Title
      doc.fontSize(20).text(settings.reportTitle || 'Metis.AI 분석 보고서', { align: 'center' });
      doc.moveDown();
      doc.fontSize(10).fillColor('#666').text(`생성일시: ${new Date().toLocaleString('ko-KR')}`, { align: 'center' });
      doc.moveDown(2);

      // Content
      doc.fontSize(11).fillColor('#000');
      const sections = this.parseContentToSections(content);

      for (const section of sections) {
        if (section.type === 'heading') {
          doc.moveDown();
          doc.fontSize(14).fillColor('#1a365d').text(section.text);
          doc.moveDown(0.3);
          doc.fontSize(11).fillColor('#000');
        } else {
          doc.text(section.text, { lineGap: 3 });
        }
      }

      doc.end();

      await new Promise<void>((resolve, reject) => {
        stream.on('finish', resolve);
        stream.on('error', reject);
      });
    } catch {
      this.logger.warn('pdfkit not available, generating HTML fallback');
      return this.generateHtml(content, baseName, outputDir, settings);
    }

    const stat = fs.statSync(filePath);
    return {
      name: fileName,
      path: filePath,
      format: 'pdf',
      size: stat.size,
      downloadUrl: `/api/workflow-nodes/download/${path.basename(outputDir)}/${fileName}`,
    };
  }

  /**
   * Generate HTML report
   */
  private async generateHtml(
    content: string,
    baseName: string,
    outputDir: string,
    settings: Record<string, any>,
  ): Promise<GeneratedFile> {
    const fileName = `${baseName}.html`;
    const filePath = path.join(outputDir, fileName);

    const title = settings.reportTitle || 'Metis.AI 분석 보고서';
    const sections = this.parseContentToSections(content);

    let bodyHtml = '';
    for (const section of sections) {
      if (section.type === 'heading') {
        bodyHtml += `<h2>${this.escapeHtml(section.text)}</h2>\n`;
      } else {
        bodyHtml += `<div class="section">${this.escapeHtml(section.text).replace(/\n/g, '<br>')}</div>\n`;
      }
    }

    const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>${this.escapeHtml(title)}</title>
  <style>
    body { font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif; max-width: 900px; margin: 0 auto; padding: 40px; color: #1a202c; line-height: 1.7; }
    h1 { color: #1a365d; border-bottom: 3px solid #3182ce; padding-bottom: 12px; }
    h2 { color: #2d3748; margin-top: 32px; border-left: 4px solid #3182ce; padding-left: 12px; }
    .section { margin: 16px 0; padding: 12px; background: #f7fafc; border-radius: 6px; white-space: pre-wrap; font-size: 14px; }
    .meta { color: #718096; font-size: 12px; margin-bottom: 24px; }
    code { background: #edf2f7; padding: 2px 6px; border-radius: 3px; font-size: 13px; }
    pre { background: #1a202c; color: #e2e8f0; padding: 16px; border-radius: 8px; overflow-x: auto; }
    @media print { body { max-width: 100%; padding: 20px; } }
  </style>
</head>
<body>
  <h1>${this.escapeHtml(title)}</h1>
  <div class="meta">생성일시: ${new Date().toLocaleString('ko-KR')} | Metis.AI Workflow Engine</div>
  ${bodyHtml}
</body>
</html>`;

    fs.writeFileSync(filePath, html, 'utf-8');

    const stat = fs.statSync(filePath);
    return {
      name: fileName,
      path: filePath,
      format: 'html',
      size: stat.size,
      downloadUrl: `/api/workflow-nodes/download/${path.basename(outputDir)}/${fileName}`,
    };
  }

  private async generateCsv(content: string, baseName: string, outputDir: string): Promise<GeneratedFile> {
    const fileName = `${baseName}.csv`;
    const filePath = path.join(outputDir, fileName);
    // Convert content to CSV-like format (best effort)
    fs.writeFileSync(filePath, content, 'utf-8');
    const stat = fs.statSync(filePath);
    return { name: fileName, path: filePath, format: 'csv', size: stat.size,
      downloadUrl: `/api/workflow-nodes/download/${path.basename(outputDir)}/${fileName}` };
  }

  private async generateJson(content: string, baseName: string, outputDir: string): Promise<GeneratedFile> {
    const fileName = `${baseName}.json`;
    const filePath = path.join(outputDir, fileName);
    const data = { generatedAt: new Date().toISOString(), content, sections: this.parseContentToSections(content) };
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    const stat = fs.statSync(filePath);
    return { name: fileName, path: filePath, format: 'json', size: stat.size,
      downloadUrl: `/api/workflow-nodes/download/${path.basename(outputDir)}/${fileName}` };
  }

  private async generateMarkdown(content: string, baseName: string, outputDir: string): Promise<GeneratedFile> {
    const fileName = `${baseName}.md`;
    const filePath = path.join(outputDir, fileName);
    const md = `# Metis.AI 분석 보고서\n\n*생성일시: ${new Date().toLocaleString('ko-KR')}*\n\n---\n\n${content}`;
    fs.writeFileSync(filePath, md, 'utf-8');
    const stat = fs.statSync(filePath);
    return { name: fileName, path: filePath, format: 'md', size: stat.size,
      downloadUrl: `/api/workflow-nodes/download/${path.basename(outputDir)}/${fileName}` };
  }

  private parseContentToSections(content: string): Array<{ type: 'heading' | 'body'; text: string }> {
    const sections: Array<{ type: 'heading' | 'body'; text: string }> = [];
    const lines = content.split('\n');
    let currentBody = '';

    for (const line of lines) {
      if (line.match(/^={3,}/) || line.match(/^-{3,}/) || line.match(/^#{1,3}\s/)) {
        if (currentBody.trim()) {
          sections.push({ type: 'body', text: currentBody.trim() });
          currentBody = '';
        }
        const headingText = line.replace(/^#{1,3}\s/, '').replace(/^[=-]+\s*/, '').trim();
        if (headingText) sections.push({ type: 'heading', text: headingText });
      } else {
        currentBody += line + '\n';
      }
    }

    if (currentBody.trim()) {
      sections.push({ type: 'body', text: currentBody.trim() });
    }

    return sections;
  }

  private formatAsText(content: string, settings: Record<string, any>): string {
    return `${settings.reportTitle || 'Metis.AI 보고서'}\n${'='.repeat(60)}\n생성일시: ${new Date().toLocaleString('ko-KR')}\n\n${content}`;
  }

  private escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  getConnectorMetadata(): ConnectorMetadata {
    return {
      key: 'metis-document-gen',
      name: '문서 생성 / 파일 내보내기',
      type: 'BUILT_IN',
      description: '분석 결과를 DOCX, PDF, HTML, CSV, JSON, Markdown 형식의 문서로 생성합니다. 보고서 템플릿, 파일명 패턴, 자동 다운로드를 지원합니다.',
      category: 'output',
      inputSchema: {
        outputFormat: { type: 'string', enum: ['docx', 'pdf', 'html', 'csv', 'json', 'md'] },
        reportTemplate: { type: 'string' },
        fileNamePattern: { type: 'string' },
        content: { type: 'string', description: '문서에 포함할 내용 (이전 노드에서 전달)' },
      },
      outputSchema: {
        fileName: { type: 'string' },
        downloadUrl: { type: 'string' },
        fileSize: { type: 'number' },
      },
      capabilities: ['docx-gen', 'pdf-gen', 'html-gen', 'csv-export', 'json-export', 'markdown-gen'],
    };
  }
}
