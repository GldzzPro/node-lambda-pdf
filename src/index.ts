import express from "express";
import { Request, Response } from "express-serve-static-core";
import puppeteer from "puppeteer";
import cors from "cors";
import bodyParser from "body-parser";

const app = express();
app.use(bodyParser.json());
app.use(express.json());
// Use CORS middleware
app.use(
  cors({
    origin: "http://localhost:5173", // Allow only this origin
    allowedHeaders: ["Content-Type"],
  })
);

// @ts-ignore
app.post("/generate-pdf", async (req: Request, res: Response) => {
  const { iframePath, iframeData } = req.body;
  if (!iframePath || !iframeData) {
    return res.status(400).json({
      error: "Missing 'iframePath' or 'iframeData' in the request body.",
    });
  }

  try {
    const browser = await puppeteer.launch({
      headless: false,
      devtools: true, // Open DevTools automatically
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      browser: "chrome",
    });
    const page = await browser.newPage();

    await page.goto(iframePath, { waitUntil: "load" });

    // Create the HTML template
    const htmlTemplate = `
       <!DOCTYPE html>
       <html lang="en">
       <head>
         <meta charset="UTF-8">
         <meta name="viewport" content="width=device-width, initial-scale=1.0">
         <title>PDF Export</title>
       </head>
       <body>
         <iframe
           src="${iframePath}"
           style="width:100%; height:100vh; border:none;"
           onload="(() => {
             const dataEl = document.createElement('script');
             dataEl.id = 'data';
             dataEl.type = 'application/json';
             dataEl.textContent = ${JSON.stringify(iframeData)});
             document.body.appendChild(dataEl);
           })()"
         ></iframe>
       </body>
       </html>
     `;

    // Load the template into Puppeteer
    await page.setContent(htmlTemplate, { waitUntil: "networkidle0" });

    await page.evaluate((iframeData) => {
      const script = document.createElement("script");
      script.type = "application/json";
      script.id = "data";
      script.textContent = JSON.stringify(iframeData);
      document.body.appendChild(script); // Append the script to the body
      debugger;
    }, iframeData);

    // Load the modified HTML into Puppeteer
    // Generate the PDF
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
    });

    await browser.close();

    // Send the PDF as a response
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=generated.pdf");
    res.send(pdfBuffer);
  } catch (error) {
    console.error("Error generating PDF:", error);
    res.status(500).json({ error: "Failed to generate PDF." });
  }
});

const PORT = 8000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
