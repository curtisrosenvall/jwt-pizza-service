// test-grafana.js
import fetch from 'node-fetch';

const HOST = "https://otlp-gateway-prod-us-west-0.grafana.net/otlp/v1/metrics";
const API_KEY = "1200089:glc_eyJvIjoiMTM3NjI3OCIsIm4iOiJzdGFjay0xMjAwMDg5LWludGVncmF0aW9uLWp3dC1waXp6YS1tZXRyaWNzIiwiayI6IkYyMG5xM001cjBXdlVMaTYxMGxPQ0I4MiIsIm0iOnsiciI6InByb2QtdXMtd2VzdC0wIn19";

const body = JSON.stringify({
  resourceMetrics: [{
    scopeMetrics: [{
      metrics: [{
        name: "test_metric",
        unit: "s",
        gauge: {
          dataPoints: [{
            asInt: 1,
            timeUnixNano: Date.now() * 1000000,
            attributes: [{
              key: "bar_label",
              value: { stringValue: "abc" }
            }]
          }]
        }
      }]
    }]
  }]
});

// This is exactly how they show it in the example
async function sendToGrafana() {
  try {
    const response = await fetch(HOST, {
      method: 'POST',
      body: body,
      headers: {
        'Authorization': `Bearer glc_eyJvIjoiMTM3NjI3OCIsIm4iOiJzdGFjay0xMjAwMDg5LWludGVncmF0aW9uLWp3dC1waXp6YS1tZXRyaWNzIiwiayI6IkYyMG5xM001cjBXdlVMaTYxMGxPQ0I4MiIsIm0iOnsiciI6InByb2QtdXMtd2VzdC0wIn19`,
        'Content-Type': 'application/json',
      },
    });
    
    console.log("Response Status:", response.status);
    const responseText = await response.text();
    console.log("Response:", responseText);
  } catch (error) {
    console.error("Error:", error);
  }
}

// Try alternative authentication format
async function sendToGrafanaAlt() {
  try {
    const response = await fetch(HOST, {
      method: 'POST',
      body: body,
      headers: {
        'Authorization': `Basic ${Buffer.from("1200089:glc_eyJvIjoiMTM3NjI3OCIsIm4iOiJzdGFjay0xMjAwMDg5LWludGVncmF0aW9uLWp3dC1waXp6YS1tZXRyaWNzIiwiayI6IkYyMG5xM001cjBXdlVMaTYxMGxPQ0I4MiIsIm0iOnsiciI6InByb2QtdXMtd2VzdC0wIn19").toString('base64')}`,
        'Content-Type': 'application/json',
      },
    });
    
    console.log("Alt Response Status:", response.status);
    const responseText = await response.text();
    console.log("Alt Response:", responseText);
  } catch (error) {
    console.error("Alt Error:", error);
  }
}

// Run both tests
sendToGrafana();
setTimeout(sendToGrafanaAlt, 2000);