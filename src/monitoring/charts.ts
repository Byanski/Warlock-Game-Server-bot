// Uses quickchart.io to generate a fast, open-source Chart.js image URL
import QuickChart from 'quickchart-js';

export class ChartGenerator {
  /**
   * Generates a URL for a time-series line graph representing player counts
   * @param labels Array of time strings (e.g., ['10:00', '10:15', '10:30'])
   * @param dataPoints Array of player counts (e.g., [10, 15, 12])
   * @param gameName The name of the game being graphed
   */
  public static generatePlayerChart(labels: string[], dataPoints: number[], gameName: string): string {
    const chart = new QuickChart();
    chart.setWidth(500)
    chart.setHeight(300);
    chart.setBackgroundColor('#1E2327'); // Dark mode background for premium feel

    const config = {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: `${gameName.toUpperCase()} Players`,
          data: dataPoints,
          borderColor: '#5865F2', // Blurple
          backgroundColor: 'rgba(88, 101, 242, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        legend: { labels: { fontColor: '#FFFFFF' } },
        scales: {
          xAxes: [{ ticks: { fontColor: '#FFFFFF' } }],
          yAxes: [{ ticks: { fontColor: '#FFFFFF', beginAtZero: true } }]
        }
      }
    };

    chart.setConfig(config);
    return chart.getUrl();
  }
}
