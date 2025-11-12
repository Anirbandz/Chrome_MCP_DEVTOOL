import { Document, Paragraph, HeadingLevel } from 'docx';
import fs from 'fs/promises';
import path from 'path';

async function generateReport(reportPath) {
    const reportData = JSON.parse(await fs.readFile(reportPath, 'utf-8'));
    
    // Create document
    const doc = new Document({
        sections: [{
            children: [
                new Paragraph({
                    text: 'Performance Test Report',
                    heading: HeadingLevel.HEADING_1
                }),
                new Paragraph({
                    text: new Date().toLocaleDateString()
                }),
                ...reportData.map(entry => [
                    new Paragraph({
                        text: `Step: ${entry.step}`,
                        heading: HeadingLevel.HEADING_2
                    }),
                    new Paragraph({
                        text: `Metrics File: ${entry.metricsPath}`
                    })
                ]).flat()
            ]
        }]
    });

    // Save document
    const outputPath = path.join(process.cwd(), 'performance_report.docx');
    await doc.save(outputPath);
    
    console.log(`Report generated: ${outputPath}`);
}

// Check if report path is provided
const reportPath = process.argv[2];
if (!reportPath) {
    console.error('Please provide the path to the performance report JSON file');
    process.exit(1);
}

generateReport(reportPath).catch(console.error);