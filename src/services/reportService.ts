import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { vehicleTypeLabel } from '@/constants/vehicles';
import type { Customer, DateRange, Invoice, JobsReport, TransportJob } from '@/types';
import { formatCurrency, formatDate, formatDateTime, partyLabel } from '@/utils/format';
import { formatQuantity, SINGLE_LINE_TITLE } from '@/utils/invoiceText';
import { composeJobText } from '@/utils/stops';
import { savePdf, type PdfFile } from './files';
import { httpBinary } from './http';
import { jobService } from './registry';
import { ServiceError } from './errors';

const DRAFT = { word: 'Taslak', stamp: 'TASLAK' };

const A4_LANDSCAPE = { width: 842, height: 595 };
const A4_PORTRAIT = { width: 595, height: 842 };

const esc = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Yazdırma motorları (iOS WKWebView, Android WebView) CSS pikselini 1/96 inç sayar: 842px genişliğindeki
 * sayfa 842pt'lik A4'ün yalnızca %75'ini kaplar ve sağda/altta boşluk kalır. Tasarım pt ölçüsünde
 * yapıldığı için yerelde 96/72 (≈1.333) yakınlaştırılır; küçük pay, fazladan boş sayfa oluşmasını önler.
 */
const PRINT_ZOOM = Platform.OS === 'web' ? 1 : 1.333;

/** AKNA logosu (sunucu PDF'leriyle aynı vektör): siyah zemin üzerinde geometrik beyaz harfler. */
const LOGO_HTML =
  '<div class="logo"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 436 102" width="96" height="22.5" fill="#fff">' +
  '<polygon points="60,0 120.5,102 0,102"/><polygon points="121,6 213.5,6 179,55 213.5,102 121,102"/>' +
  '<polygon points="219,4.5 267,40 267,6 314.5,6 314.5,102 219,102"/><polygon points="376,0 436,102 316,102"/></svg></div>';
const LOGO_CSS = `
  .logo { display: inline-block; background: #000; border-radius: 5px; padding: 12px 14px; line-height: 0; }
`;

const BASE_CSS = `${LOGO_CSS}
  @page { margin: 0; }
  html { zoom: ${PRINT_ZOOM}; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: #fff; }
  body { font-family: -apple-system, 'Helvetica Neue', Helvetica, Roboto, Arial, sans-serif; color: #000000; -webkit-print-color-adjust: exact; }
  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
`;

export interface JobsReportOptions {
  customerId?: string;
  onlyCompleted?: boolean;
}

/** Satır yüksekliğini açıklama uzunluğundan tahmin ederek sayfalara böler. */
function paginate<T>(rows: T[], weight: (row: T) => number, firstCapacity: number, capacity: number, lastReserve: number): T[][] {
  const pages: T[][] = [];
  let current: T[] = [];
  let used = 0;
  let cap = firstCapacity;
  for (const row of rows) {
    const w = weight(row);
    if (current.length && used + w > cap) {
      pages.push(current);
      current = [];
      used = 0;
      cap = capacity;
    }
    current.push(row);
    used += w;
  }
  // Toplam alanı son sayfaya sığmıyorsa son satırları (toplamla birlikte) yeni sayfaya taşı
  if (current.length && used + lastReserve > cap) {
    const moved: T[] = [];
    while (current.length > 1 && used + lastReserve > cap) {
      const row = current.pop()!;
      used -= weight(row);
      moved.unshift(row);
    }
    if (moved.length) {
      pages.push(current);
      current = moved;
    }
  }
  pages.push(current);
  return pages;
}

/**
 * Döküm sayfa ölçüleri (yakınlaştırma öncesi px). Satırlar sayfaya tahmini yükseklikle yerleştirilir; tahmin
 * düşük kalırsa satırlar sayfanın altında kesilip kaybolur (.page overflow: hidden). Bu yüzden karakter/satır
 * değerleri gerçek ölçümden (Chromium, 10.5px yazı) biraz düşük, sayfa alanları da birkaç px pay bırakılarak seçildi.
 */
const ROW_PADDING_PX = 17; // 8 + 8 dolgu + kenarlık
const ROW_LINE_PX = 15; // 10.5px × 1.4 satır yüksekliği
const PARTY_CHARS_PER_LINE = 20; // Firma / Mağaza sütunu (kalın yazı, ~150px; büyük harfli unvanlar daha geniş)
const ROUTE_CHARS_PER_LINE = 40; // Yapılan Nakliyeler sütunu (~246px)
const FIRST_PAGE_BODY_PX = 384; // başlıklı ilk sayfada tablo gövdesi için alan
const PAGE_BODY_PX = 446; // sonraki sayfalarda
const TOTALS_PX = 96; // son sayfadaki toplam kutusu

/** Metnin sütunda kaç satıra kayacağını kelime kelime tahmin eder. */
function wrappedLines(text: string, perLine: number): number {
  let lines = 1;
  let used = 0;
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const len = word.length;
    if (used === 0) {
      lines += Math.floor(Math.max(0, len - 1) / perLine);
      used = len % perLine || perLine;
    } else if (used + 1 + len <= perLine) {
      used += 1 + len;
    } else {
      lines += 1 + Math.floor(Math.max(0, len - 1) / perLine);
      used = len % perLine || perLine;
    }
  }
  return lines;
}

function jobsReportHtml(report: JobsReport, title = 'NAKLİYE İŞLERİ DÖKÜMÜ'): string {
  const generated = formatDateTime(report.generatedAt);
  const rangeLabel = `${formatDate(report.range.from)} – ${formatDate(report.range.to)}`;
  // Ağırlık: satırın tahmini yüksekliği (px). En çok satıra kayan sütun (firma veya yapılan nakliye) belirler.
  const pages = paginate(
    report.jobs,
    (j) =>
      ROW_PADDING_PX +
      ROW_LINE_PX *
        Math.max(
          wrappedLines(partyLabel(j.customerName, j.storeName), PARTY_CHARS_PER_LINE),
          wrappedLines(composeJobText(j.routeDescription, j.description), ROUTE_CHARS_PER_LINE),
        ),
    FIRST_PAGE_BODY_PX,
    PAGE_BODY_PX,
    TOTALS_PX,
  );
  const totalPages = pages.length;

  const header = `
    <header class="head">
      <div>
        ${LOGO_HTML}
        <div class="doc">${esc(title)}</div>
      </div>
      <div class="meta">
        <div><span>Dönem</span>${rangeLabel}</div>
        <div><span>İş sayısı</span>${report.totalCount}</div>
      </div>
    </header>`;

  const tableHead = `
    <thead><tr>
      <th style="width:84px">Tarih</th>
      <th style="width:170px">Firma / Mağaza</th>
      <th style="width:112px">Araç</th>
      <th>Yapılan Nakliyeler</th>
      <th class="num" style="width:130px">Fiyat</th>
    </tr></thead>`;

  const body = pages
    .map((rows, i) => {
      const isFirst = i === 0;
      const isLast = i === totalPages - 1;
      const trs = rows
        .map(
          (j) => `<tr>
            <td>${formatDate(j.date)}</td>
            <td class="strong">${esc(partyLabel(j.customerName, j.storeName))}</td>
            <td>${vehicleTypeLabel(j.vehicleType)}</td>
            <td>${esc(composeJobText(j.routeDescription, j.description))}</td>
            <td class="num strong">${formatCurrency(j.price)} + KDV</td>
          </tr>`,
        )
        .join('');
      const empty = report.jobs.length === 0 ? `<tr><td colspan="5" class="empty">Seçilen dönemde iş kaydı bulunmuyor.</td></tr>` : '';
      const totals = isLast
        ? `<section class="totals">
            <div class="row"><span>Toplam iş sayısı</span><strong>${report.totalCount}</strong></div>
            <div class="row grand"><span>Toplam nakliye tutarı</span><strong>${formatCurrency(report.totalAmount, { decimals: 2 })} + KDV</strong></div>
          </section>`
        : '';
      return `<div class="page">
        ${isFirst ? header : `<div class="mini">AKNA TRANSPORT · NAKLİYE İŞLERİ DÖKÜMÜ · ${rangeLabel}</div>`}
        <table>${tableHead}<tbody>${trs}${empty}</tbody></table>
        ${totals}
        <footer><span>Oluşturulma: ${generated}</span><span>Sayfa ${i + 1} / ${totalPages}</span></footer>
      </div>`;
    })
    .join('');

  return `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8" />
  <meta name="viewport" content="width=${A4_LANDSCAPE.width}" />
  <style>
    ${BASE_CSS}
    .page { width: ${A4_LANDSCAPE.width}px; height: ${A4_LANDSCAPE.height}px; padding: 34px 40px 46px; position: relative; overflow: hidden; page-break-after: always; }
    .page:last-child { page-break-after: auto; }
    .head { display: flex; justify-content: space-between; align-items: flex-end; padding-bottom: 14px; border-bottom: 2px solid #000000; margin-bottom: 16px; }
    .brand { font-size: 20px; font-weight: 800; letter-spacing: 3px; }
    .doc { font-size: 11px; font-weight: 600; letter-spacing: 2px; color: #555555; margin-top: 4px; }
    .meta { display: flex; gap: 28px; font-size: 11px; font-weight: 600; }
    .meta span { display: block; font-size: 8.5px; letter-spacing: 1.2px; text-transform: uppercase; color: #888888; margin-bottom: 3px; font-weight: 600; }
    .mini { font-size: 9px; letter-spacing: 1.4px; color: #888888; font-weight: 600; padding-bottom: 10px; border-bottom: 1px solid #CCCCCC; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 10.5px; }
    th { text-align: left; font-size: 8.5px; letter-spacing: 1.1px; text-transform: uppercase; color: #fff; background: #000000; padding: 8px 10px; font-weight: 600; }
    th.num { text-align: right; }
    td { padding: 8px 10px; border-bottom: 1px solid #E0E0E0; vertical-align: top; line-height: 1.4; }
    tbody tr:nth-child(even) td { background: #F5F5F5; }
    .strong { font-weight: 600; }
    .empty { text-align: center; color: #888888; padding: 28px; }
    .totals { margin-left: auto; width: 300px; margin-top: 16px; border: 1px solid #000000; }
    .totals .row { display: flex; justify-content: space-between; padding: 9px 12px; font-size: 11px; }
    .totals .row + .row { border-top: 1px solid #E0E0E0; }
    .totals .grand { background: #000000; color: #fff; font-size: 12.5px; }
    footer { position: absolute; left: 40px; right: 40px; bottom: 20px; display: flex; justify-content: space-between; font-size: 8.5px; color: #888888; border-top: 1px solid #E0E0E0; padding-top: 8px; letter-spacing: 0.3px; }
  </style></head><body>${body}</body></html>`;
}

const INVOICE_STATUS_TEXT: Record<Invoice['status'], string> = {
  demo_draft: 'Taslak',
  demo_created: 'Demo fatura',
  cancelled: 'İptal edildi',
  earsiv_pending: 'e-Arşiv gönderimi bekleniyor',
  earsiv_issued: 'e-Arşiv faturası',
  earsiv_failed: 'e-Arşiv gönderimi başarısız',
};

function invoiceHtml(invoice: Invoice, customer: Customer | null): string {
  const isDemo = invoice.mode === 'demo';
  return `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8" />
  <style>
    ${BASE_CSS}
    .page { width: ${A4_PORTRAIT.width}px; min-height: ${A4_PORTRAIT.height}px; padding: 40px 42px; position: relative; }
    .banner { border: 1px dashed #000000; padding: 8px 12px; font-size: 9.5px; font-weight: 600; letter-spacing: 0.4px; margin-bottom: 22px; }
    .watermark { position: absolute; top: 330px; left: 0; right: 0; text-align: center; font-size: 120px; font-weight: 800; color: rgba(0,0,0,0.05); letter-spacing: 18px; transform: rotate(-24deg); }
    .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #000000; padding-bottom: 16px; }
    .brand { font-size: 18px; font-weight: 800; letter-spacing: 3px; }
    .muted { color: #888888; }
    .label { font-size: 8px; letter-spacing: 1.2px; text-transform: uppercase; color: #888888; font-weight: 600; margin-bottom: 3px; }
    .title { font-size: 12px; font-weight: 700; letter-spacing: 2px; text-align: right; }
    .grid { display: flex; gap: 24px; margin: 22px 0; font-size: 10.5px; line-height: 1.5; }
    .grid > div { flex: 1; }
    table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
    th { text-align: left; font-size: 8px; letter-spacing: 1.1px; text-transform: uppercase; background: #000000; color: #fff; padding: 8px 10px; }
    td { padding: 10px; border-bottom: 1px solid #E0E0E0; }
    .totals { margin-left: auto; width: 240px; margin-top: 18px; font-size: 11px; }
    .totals div { display: flex; justify-content: space-between; padding: 7px 0; border-bottom: 1px solid #E0E0E0; }
    .totals .grand { border: none; background: #000000; color: #fff; padding: 9px 10px; font-weight: 700; margin-top: 6px; }
    footer { position: absolute; left: 42px; right: 42px; bottom: 28px; font-size: 8.5px; color: #888888; border-top: 1px solid #E0E0E0; padding-top: 8px; }
  </style></head><body><div class="page">
    ${isDemo ? `<div class="watermark">${DRAFT.stamp}</div><div class="banner">${DRAFT.stamp} BELGE — Bu belge uygulama içinde oluşturulmuş bir önizlemedir. Resmi e-Arşiv faturası değildir ve mali geçerliliği yoktur.</div>` : ''}
    <div class="head">
      <div>${LOGO_HTML}<div class="muted" style="font-size:10px;margin-top:6px">Nakliye ve Lojistik Hizmetleri</div></div>
      <div>
        <div class="title">${isDemo ? `${DRAFT.stamp} FATURA` : 'e-ARŞİV FATURA'}</div>
        <div style="font-size:10.5px;text-align:right;margin-top:6px">${esc(invoice.invoiceNo)}<br/>${formatDate(invoice.issueDate)}</div>
      </div>
    </div>
    <div class="grid">
      <div>
        <div class="label">Sayın</div>
        <strong>${esc(invoice.customerName)}</strong><br/>
        ${customer ? `${esc(customer.billingAddress)}<br/>${esc(customer.taxOffice)} · VKN ${esc(customer.taxNumber)}` : ''}
      </div>
      <div>
        <div class="label">Fatura bilgileri</div>
        ${invoice.freeForm ? '' : `İş no: ${esc(invoice.jobNos?.length ? invoice.jobNos.join(', ') : invoice.jobNo)}<br/>`}
        Durum: ${INVOICE_STATUS_TEXT[invoice.status]}<br/>
        ${invoice.ettn ? `ETTN: ${esc(invoice.ettn)}` : ''}
      </div>
    </div>
    <table>
      <thead><tr><th>Açıklama</th><th class="num" style="width:70px">Miktar</th><th class="num" style="width:110px">Tutar</th></tr></thead>
      <tbody>${
        invoice.singleLine
          ? `<tr><td>${esc(SINGLE_LINE_TITLE)}</td><td class="num">1 Adet</td><td class="num">${formatCurrency(invoice.subtotal, { decimals: 2 })}</td></tr>`
          : invoice.items?.length
          ? invoice.items
              .map((it) =>
                it.jobId
                  ? `<tr><td>${esc(it.jobNo)} · ${formatDate(it.jobDate)} · ${esc(it.description)}</td><td class="num">1 Adet</td><td class="num">${formatCurrency(it.amount, { decimals: 2 })}</td></tr>`
                  : `<tr><td>${esc(it.description)}</td><td class="num">${formatQuantity(it.quantity ?? 1)} Adet</td><td class="num">${formatCurrency(it.amount, { decimals: 2 })}</td></tr>`,
              )
              .join('')
          : `<tr><td>${esc(invoice.description)}</td><td class="num"></td><td class="num">${formatCurrency(invoice.subtotal, { decimals: 2 })}</td></tr>`
      }</tbody>
    </table>
    <div class="totals">
      <div><span>Ara toplam</span><span class="num">${formatCurrency(invoice.subtotal, { decimals: 2 })}</span></div>
      <div><span>KDV (%${invoice.vatRate})</span><span class="num">${formatCurrency(invoice.vatAmount, { decimals: 2 })}</span></div>
      ${
        invoice.withholdingCode
          ? `<div><span>Vergiler dahil toplam</span><span class="num">${formatCurrency(invoice.total, { decimals: 2 })}</span></div>
      <div><span>KDV tevkifatı ${(invoice.withholdingRate ?? 0) / 10}/10 (${esc(invoice.withholdingCode)})</span><span class="num">−${formatCurrency(invoice.withholdingAmount ?? 0, { decimals: 2 })}</span></div>
      <div class="grand"><span>Ödenecek tutar</span><span class="num">${formatCurrency(invoice.payableAmount ?? invoice.total, { decimals: 2 })}</span></div>`
          : `<div class="grand"><span>Genel toplam</span><span class="num">${formatCurrency(invoice.total, { decimals: 2 })}</span></div>`
      }
    </div>
    ${
      invoice.amountInWords || invoice.iban
        ? `<div style="margin-top:16px;padding:8px 10px;border:1px solid #E0E0E0;font-size:11px">
      <div style="font-size:9px;color:#555">AÇIKLAMA</div>
      ${invoice.amountInWords ? `<div style="font-weight:600;margin-top:3px">${esc(invoice.amountInWords)}</div>` : ''}
      ${invoice.iban ? `<div style="margin-top:3px">IBAN: ${esc(invoice.iban)}${invoice.bankName ? ` (${esc(invoice.bankName)})` : ''}</div>` : ''}
    </div>`
        : ''
    }
    <footer>Oluşturulma: ${formatDateTime(invoice.createdAt)}${isDemo ? ` · ${DRAFT.word} belge, resmi geçerliliği yoktur.` : ''}</footer>
  </div></body></html>`;
}

async function htmlToPdf(html: string, size: { width: number; height: number }, fileName: string): Promise<string> {
  const { uri } = await Print.printToFileAsync({ html, ...size });
  if (Platform.OS === 'web') return uri;
  try {
    const target = new File(Paths.cache, fileName);
    if (target.exists) target.delete();
    new File(uri).move(target);
    return target.uri;
  } catch {
    return uri; // yeniden adlandırma başarısızsa geçici dosya ile devam et
  }
}

async function share(uri: string, title: string) {
  if (!(await Sharing.isAvailableAsync())) {
    throw new ServiceError('not_implemented', 'Bu cihazda dosya paylaşımı desteklenmiyor.');
  }
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: title });
}

const fileSafe = (s: string) => s.replace(/[^\w.-]+/g, '_');
/** Saf fonksiyon: önizleme ve PDF aynı hesaplamayı kullanır. */
export function composeJobsReport(jobs: TransportJob[], range: DateRange, opts: JobsReportOptions = {}): JobsReport {
  const included = jobs
    .filter(
      (j) =>
        j.date >= range.from &&
        j.date <= range.to &&
        (!opts.customerId || j.customerId === opts.customerId) &&
        (opts.onlyCompleted ? j.status === 'completed' : j.status !== 'cancelled'),
    )
    .sort((a, b) => a.date.localeCompare(b.date) || a.jobNo.localeCompare(b.jobNo));
  return {
    range,
    jobs: included,
    totalCount: included.length,
    totalAmount: included.reduce((s, j) => s + j.price, 0),
    generatedAt: new Date().toISOString(),
  };
}

export const reportService = {
  /** Seçilen tarih aralığındaki işlerden döküm verisini servis üzerinden hazırlar. */
  async buildJobsReport(range: DateRange, opts: JobsReportOptions = {}): Promise<JobsReport> {
    const jobs = await jobService.list({ dateFrom: range.from, dateTo: range.to, customerId: opts.customerId });
    return composeJobsReport(jobs, range, opts);
  },

  composeJobsReport,
  jobsReportHtml,
  invoiceHtml,

  /**
   * Tarih aralığı dökümünün PDF'i. Önce sunucudaki döküm kullanılır: sunucu satırları gerçek yüksekliğiyle
   * sayfalara böler ve tablo başlığını her sayfada tekrarlar. Telefonda HTML'den üretilen PDF'te sayfa bölmesi
   * tahmine dayandığından uzun firma adlarında satırlar kesilebiliyordu; o yalnızca sunucuya ulaşılamazsa kullanılır.
   */
  async jobsReportPdfFor(range: DateRange, opts: JobsReportOptions = {}): Promise<PdfFile> {
    const name = `AKNA_Is_Dokumu_${formatDate(range.from)}-${formatDate(range.to)}.pdf`;
    try {
      const query = new URLSearchParams({ startDate: range.from, endDate: range.to, scope: opts.onlyCompleted ? 'Completed' : 'NotCancelled' });
      if (opts.customerId) query.set('customerId', opts.customerId);
      const bytes = await httpBinary(`/api/reports/jobs/pdf?${query.toString()}`);
      return { uri: await savePdf(bytes, name), title: 'Nakliye işleri dökümü' };
    } catch (e) {
      // Sunucu reddettiyse (ör. tarih aralığında çok fazla iş) mesajı göster; bağlantı sorununda cihazda üret.
      if (e instanceof ServiceError && e.code === 'validation') throw e;
      return reportService.jobsReportPdf(await reportService.buildJobsReport(range, opts));
    }
  },

  /** Tarih aralığı dökümünün PDF'ini cihazda HTML'den üretir (sunucuya ulaşılamadığında yedek). */
  async jobsReportPdf(report: JobsReport): Promise<{ uri: string; title: string }> {
    const name = fileSafe(`AKNA_Is_Dokumu_${formatDate(report.range.from)}-${formatDate(report.range.to)}.pdf`);
    return { uri: await htmlToPdf(jobsReportHtml(report), A4_LANDSCAPE, name), title: 'Nakliye işleri dökümü' };
  },

  async shareJobsReport(report: JobsReport) {
    const pdf = await reportService.jobsReportPdf(report);
    await share(pdf.uri, pdf.title);
  },

  async printJobsReport(report: JobsReport) {
    await Print.printAsync({ html: jobsReportHtml(report), ...A4_LANDSCAPE, orientation: Print.Orientation.landscape });
  },

  /** Dökümü sunucudaki PDF'ten yazdırır (sayfa bölmesi önizlemeyle aynı). */
  async printJobsReportFor(range: DateRange, opts: JobsReportOptions = {}) {
    const pdf = await reportService.jobsReportPdfFor(range, opts);
    await Print.printAsync({ uri: pdf.uri, orientation: Print.Orientation.landscape });
  },

  async invoicePdf(invoice: Invoice, customer: Customer | null): Promise<{ uri: string; title: string }> {
    return { uri: await htmlToPdf(invoiceHtml(invoice, customer), A4_PORTRAIT, fileSafe(`${invoice.invoiceNo}.pdf`)), title: invoice.invoiceNo };
  },

  async shareInvoice(invoice: Invoice, customer: Customer | null) {
    const pdf = await reportService.invoicePdf(invoice, customer);
    await share(pdf.uri, pdf.title);
  },

  /** Faturadaki işlerin dökümü (sunucu PDF'i indirilemeyen ortamlarda cihazda üretilir). */
  async invoiceJobReportPdf(invoice: Invoice, jobs: TransportJob[]): Promise<{ uri: string; title: string }> {
    const sorted = [...jobs].sort((a, b) => a.date.localeCompare(b.date) || a.jobNo.localeCompare(b.jobNo));
    const report: JobsReport = {
      range: { from: sorted[0]?.date ?? invoice.issueDate, to: sorted[sorted.length - 1]?.date ?? invoice.issueDate },
      jobs: sorted,
      totalCount: sorted.length,
      totalAmount: sorted.reduce((sum, j) => sum + j.price, 0),
      generatedAt: new Date().toISOString(),
    };
    const uri = await htmlToPdf(jobsReportHtml(report, `${invoice.invoiceNo} · İŞ DÖKÜMÜ`), A4_LANDSCAPE, fileSafe(`Is_Dokumu_${invoice.invoiceNo}.pdf`));
    return { uri, title: `${invoice.invoiceNo} iş dökümü` };
  },

  async printInvoice(invoice: Invoice, customer: Customer | null) {
    await Print.printAsync({ html: invoiceHtml(invoice, customer), ...A4_PORTRAIT });
  },
};
