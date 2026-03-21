"""Time-series forecasting for publication trends."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date

import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class ForecastPoint:
    month: str
    predicted: float
    lower_80: float
    upper_80: float


def forecast_series(
    monthly: list[tuple[date, int]],
    horizon: int = 6,
) -> list[ForecastPoint]:
    """Forecast future monthly counts using exponential smoothing.

    - 12+ data points: Holt-Winters (additive trend, no seasonality)
    - 3-11 data points: linear regression fallback
    - <3 data points: returns empty list

    Args:
        monthly: Sorted (date, count) pairs.
        horizon: Number of months to forecast.

    Returns:
        List of ForecastPoint with predicted value and 80% confidence interval.
    """
    if len(monthly) < 3:
        return []

    counts = np.array([c for _, c in monthly], dtype=float)
    last_date = monthly[-1][0]

    if len(monthly) >= 12:
        predicted, intervals = _holt_winters_forecast(counts, horizon)
    else:
        predicted, intervals = _linear_forecast(counts, horizon)

    results: list[ForecastPoint] = []
    for i in range(horizon):
        # Advance month from last_date
        m = last_date.month + i + 1
        y = last_date.year + (m - 1) // 12
        m = ((m - 1) % 12) + 1
        month_str = f"{y:04d}-{m:02d}"

        pred = max(0.0, predicted[i])
        lo, hi = intervals[i]
        results.append(ForecastPoint(
            month=month_str,
            predicted=round(pred, 1),
            lower_80=round(max(0.0, lo), 1),
            upper_80=round(max(0.0, hi), 1),
        ))

    return results


def _holt_winters_forecast(
    counts: np.ndarray,
    horizon: int,
) -> tuple[np.ndarray, list[tuple[float, float]]]:
    """Double exponential smoothing (Holt's linear trend)."""
    try:
        import warnings

        from statsmodels.tsa.holtwinters import ExponentialSmoothing

        with warnings.catch_warnings():
            warnings.simplefilter("ignore", RuntimeWarning)
            model = ExponentialSmoothing(
                counts,
                trend="add",
                seasonal=None,
                initialization_method="estimated",
            ).fit(optimized=True)

        forecast = model.forecast(horizon)
        # Estimate prediction intervals from residuals
        residuals = model.resid
        std = float(np.std(residuals)) if len(residuals) > 0 else 0.0
        z80 = 1.28  # 80% CI

        intervals = []
        for i in range(horizon):
            spread = z80 * std * np.sqrt(1 + i * 0.1)
            intervals.append((float(forecast[i]) - spread, float(forecast[i]) + spread))

        return np.array(forecast, dtype=float), intervals
    except ImportError:
        logger.warning("statsmodels not available, falling back to linear forecast")
        return _linear_forecast(counts, horizon)


def _linear_forecast(
    counts: np.ndarray,
    horizon: int,
) -> tuple[np.ndarray, list[tuple[float, float]]]:
    """Simple linear regression forecast."""
    x = np.arange(len(counts), dtype=float)
    coeffs = np.polyfit(x, counts, 1)
    slope, intercept = coeffs[0], coeffs[1]

    residuals = counts - (slope * x + intercept)
    std = float(np.std(residuals))
    z80 = 1.28

    future_x = np.arange(len(counts), len(counts) + horizon, dtype=float)
    predicted = slope * future_x + intercept

    intervals = []
    for i in range(horizon):
        spread = z80 * std * np.sqrt(1 + i * 0.15)
        intervals.append((float(predicted[i]) - spread, float(predicted[i]) + spread))

    return predicted, intervals
