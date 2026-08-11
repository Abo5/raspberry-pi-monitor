// Alert formatting helpers.
import { AlertRule } from '../types';
import { SERIES } from './series';
import { fmtValue } from './format';

export function alertTitle(rule: AlertRule): string {
  const meta = SERIES[rule.seriesKey];
  const f = fmtValue(rule.seriesKey, rule.threshold);
  return `${meta.title} ${rule.op} ${f.value}${f.unit ? ' ' + f.unit : ''}`;
}
