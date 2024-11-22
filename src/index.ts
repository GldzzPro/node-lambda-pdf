import express from "express";
import { Request, Response } from "express-serve-static-core";
import puppeteer from "puppeteer";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
// Load environment variables from .env file
dotenv.config();
const PORT = process.env.PORT || 8000;
const HOST_DOMAIN = process.env.HOST_DOMAIN;
const app = express();
app.use(bodyParser.json());
app.use(express.json());
// Use CORS middleware
app.use(cors());
const browserPromise = puppeteer.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});
// @ts-ignore
app.post("/generate-pdf", async (req: Request, res: Response) => {
  const { path, data } = req.body;
  if (!path || !data) {
    return res.status(400).json({
      error: "Missing 'iframePath' or 'iframeData' in the request body.",
    });
  }

  try {
    const browser = await browserPromise;
    const page = await browser.newPage();
    const fullPath = HOST_DOMAIN + "/" + path;
    await page.goto(fullPath, {
      waitUntil: "domcontentloaded",
    });

    const pageHtmlDoc = await page.$("html");

    if (!pageHtmlDoc) {
      throw new Error("Failed to find the <html> element");
    }

    await page.screenshot({ path: "unEvaluated_page.png" });

    // Evaluate and capture the modified HTML content
    await page.evaluate((data) => {
      const addedToWindow: { notify?: () => void; isPdfReady?: boolean } =
        window as {};
      return new Promise<void>((onPdfReady) => {
        Object.assign(window, { data, onPdfReady });
        addedToWindow["notify"]?.();
      });
    }, data);

    console.log("PDF will generate now");
    page.emulateMediaType("screen");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=generated.pdf");
    return page
      .pdf({
        format: "A4",
        printBackground: true,
        margin: {
          bottom: "0",
          left: "0",
          right: "0",
          top: "0",
        },
      })
      .then((pdfBuffer) => res.send(Buffer.from(pdfBuffer)))
      .then(() => page.close());

    // Send the PDF as a response
  } catch (error) {
    console.error("Error generating PDF:", error);
    res.status(500).json({ error: "Failed to generate PDF." });
  }
});

app.listen(PORT, () => {
  console.log(`Pdf Server is running on port ${PORT}`);
});
