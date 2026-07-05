import express from 'express';
import { BetaAnalyticsDataClient } from '@google-analytics/data';

const app = express();
const analytics = new BetaAnalyticsDataClient();

const PROPERTY_ID = process.env.GA4_PROPERTY_ID || '544281382';
const CACHE_TTL_MS = Number(process.env.CACHE_TTL_MS || 15 * 60 * 1000);
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://lyle-morris.github.io';

let cache = null;
let cacheAt = 0;

function cors(req, res, next) {
  const origin = req.headers.origin;
  if (!origin || origin === ALLOWED_ORIGIN) {
    res.setHeader('Access-Control-Allow-Origin', origin || ALLOWED_ORIGIN);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
}

function metricValue(row, index = 0) {
  return Number(row?.metricValues?.[index]?.value || 0);
}

function dimensionValue(row, index = 0) {
  return row?.dimensionValues?.[index]?.value || 'Unknown';
}

async function runReport(request) {
  const [response] = await analytics.runReport({
    property: `properties/${PROPERTY_ID}`,
    ...request
  });
  return response.rows || [];
}

async function buildDashboardPayload() {
  const dateRanges = [{ startDate: '30daysAgo', endDate: 'today' }];

  const [summaryRows, eventRows, countryRows, pageRows, dailyRows] = await Promise.all([
    runReport({
      dateRanges,
      metrics: [
        { name: 'activeUsers' },
        { name: 'newUsers' },
        { name: 'sessions' },
        { name: 'screenPageViews' },
        { name: 'eventCount' }
      ]
    }),
    runReport({
      dateRanges,
      dimensions: [{ name: 'eventName' }],
      metrics: [{ name: 'eventCount' }],
      orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
      limit: 25
    }),
    runReport({
      dateRanges,
      dimensions: [{ name: 'country' }],
      metrics: [{ name: 'activeUsers' }],
      orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
      limit: 20
    }),
    runReport({
      dateRanges,
      dimensions: [{ name: 'pagePath' }],
      metrics: [{ name: 'screenPageViews' }],
      orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
      limit: 20
    }),
    runReport({
      dateRanges,
      dimensions: [{ name: 'date' }],
      metrics: [{ name: 'activeUsers' }, { name: 'screenPageViews' }, { name: 'eventCount' }],
      orderBys: [{ dimension: { dimensionName: 'date' } }],
      limit: 31
    })
  ]);

  const summary = summaryRows[0] || {};
  const activeUsers = metricValue(summary, 0);
  const newUsers = metricValue(summary, 1);
  const sessions = metricValue(summary, 2);
  const pageViews = metricValue(summary, 3);
  const eventCount = metricValue(summary, 4);

  return {
    generated_at: new Date().toISOString(),
    range: 'last_30_days',
    summary: {
      active_users: activeUsers,
      new_users: newUsers,
      returning_users_estimate: Math.max(activeUsers - newUsers, 0),
      sessions,
      page_views: pageViews,
      event_count: eventCount
    },
    events: eventRows.map(row => ({ name: dimensionValue(row), count: metricValue(row) })),
    countries: countryRows.map(row => ({ country: dimensionValue(row), active_users: metricValue(row) })),
    pages: pageRows.map(row => ({ path: dimensionValue(row), views: metricValue(row) })),
    daily: dailyRows.map(row => ({
      date: dimensionValue(row),
      active_users: metricValue(row, 0),
      page_views: metricValue(row, 1),
      event_count: metricValue(row, 2)
    }))
  };
}

app.use(cors);

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'daypal-analytics-api' });
});

app.get('/api/daypal-analytics', async (_req, res) => {
  try {
    const now = Date.now();
    if (cache && now - cacheAt < CACHE_TTL_MS) {
      return res.json({ ...cache, cached: true });
    }
    const payload = await buildDashboardPayload();
    cache = payload;
    cacheAt = now;
    res.json({ ...payload, cached: false });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'analytics_fetch_failed', message: error.message });
  }
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`DayPal analytics API listening on ${port}`);
});
