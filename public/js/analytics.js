// Analytics & Visualizations Engine
let dashboardChart = null;
let deptChart = null;
let channelChart = null;
let priorityChart = null;
let statusChart = null;

const AnalyticsModule = {
  initDashboardOverviewChart() {
    const ctx = document.getElementById('dashboardOverviewChart');
    if (!ctx) return;

    if (dashboardChart) dashboardChart.destroy();

    dashboardChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        datasets: [
          {
            label: 'New Tickets',
            data: [14, 22, 19, 27, 34, 18, 12],
            borderColor: '#6366f1',
            backgroundColor: 'rgba(99, 102, 241, 0.1)',
            fill: true,
            tension: 0.4,
            borderWidth: 2,
            pointBackgroundColor: '#6366f1'
          },
          {
            label: 'Resolved',
            data: [12, 18, 24, 25, 30, 22, 15],
            borderColor: '#10b981',
            backgroundColor: 'transparent',
            tension: 0.4,
            borderWidth: 2,
            pointBackgroundColor: '#10b981'
          },
          {
            label: 'Telegram Bot Origin',
            data: [8, 14, 11, 19, 23, 13, 9],
            borderColor: '#06b6d4',
            borderDash: [5, 5],
            backgroundColor: 'transparent',
            tension: 0.4,
            borderWidth: 2,
            pointBackgroundColor: '#06b6d4'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0f172a',
            titleColor: '#f8fafc',
            bodyColor: '#cbd5e1',
            borderColor: 'rgba(255,255,255,0.1)',
            borderWidth: 1,
            padding: 10
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.04)' },
            ticks: { color: '#64748b', font: { family: 'Plus Jakarta Sans' } }
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.04)' },
            ticks: { color: '#64748b', font: { family: 'Plus Jakarta Sans' } }
          }
        }
      }
    });
  },

  renderAnalyticsCharts(analyticsData) {
    if (!analyticsData) return;

    // 1. Department Breakdown
    const deptCtx = document.getElementById('deptChart');
    if (deptCtx) {
      if (deptChart) deptChart.destroy();
      const labels = Object.keys(analyticsData.departments || { 'Technical Support': 3, 'Billing': 1, 'Product': 1 });
      const values = Object.values(analyticsData.departments || { 'Technical Support': 3, 'Billing': 1, 'Product': 1 });

      deptChart = new Chart(deptCtx, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{
            data: values,
            backgroundColor: ['#6366f1', '#06b6d4', '#f59e0b', '#ec4899'],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans', size: 11 } }
            }
          }
        }
      });
    }

    // 2. Channel Breakdown
    const channelCtx = document.getElementById('channelChart');
    if (channelCtx) {
      if (channelChart) channelChart.destroy();
      channelChart = new Chart(channelCtx, {
        type: 'pie',
        data: {
          labels: ['Telegram Bot', 'Web Customer Portal'],
          datasets: [{
            data: [analyticsData.telegramCount || 3, analyticsData.webCount || 2],
            backgroundColor: ['#229ed9', '#8b5cf6'],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans', size: 11 } }
            }
          }
        }
      });
    }

    // 3. Priority Severity Breakdown
    const priorityCtx = document.getElementById('priorityChart');
    if (priorityCtx) {
      if (priorityChart) priorityChart.destroy();
      priorityChart = new Chart(priorityCtx, {
        type: 'bar',
        data: {
          labels: ['Urgent (P1)', 'High', 'Medium', 'Low'],
          datasets: [{
            label: 'Tickets',
            data: [
              analyticsData.urgent || 1,
              analyticsData.high || 2,
              analyticsData.medium || 1,
              analyticsData.low || 1
            ],
            backgroundColor: ['#f43f5e', '#f59e0b', '#3b82f6', '#94a3b8'],
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: '#64748b' }
            },
            y: {
              grid: { color: 'rgba(255, 255, 255, 0.04)' },
              ticks: { color: '#64748b', stepSize: 1 }
            }
          }
        }
      });
    }

    // 4. Status Velocity
    const statusCtx = document.getElementById('statusChart');
    if (statusCtx) {
      if (statusChart) statusChart.destroy();
      statusChart = new Chart(statusCtx, {
        type: 'polarArea',
        data: {
          labels: ['Open', 'In Progress', 'Waiting Customer', 'Resolved', 'Closed'],
          datasets: [{
            data: [
              analyticsData.open || 1,
              analyticsData.inProgress || 1,
              analyticsData.waiting || 1,
              analyticsData.resolved || 1,
              analyticsData.closed || 1
            ],
            backgroundColor: [
              'rgba(251, 191, 36, 0.7)',
              'rgba(59, 130, 246, 0.7)',
              'rgba(249, 115, 22, 0.7)',
              'rgba(16, 185, 129, 0.7)',
              'rgba(148, 163, 184, 0.7)'
            ],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: { color: '#94a3b8', font: { size: 10 } }
            }
          },
          scales: {
            r: {
              grid: { color: 'rgba(255, 255, 255, 0.04)' },
              ticks: { display: false }
            }
          }
        }
      });
    }
  }
};
