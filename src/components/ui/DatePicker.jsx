import {
  addDays, addMonths, endOfDay, endOfMonth, endOfWeek, format, isEqual,
  isSameDay, isSameMonth, isToday, isValid, isWithinInterval, parse, startOfDay,
  startOfMonth, startOfWeek, sub, subDays, subHours, subMinutes, subMonths,
  subWeeks, subYears
} from "date-fns";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import clsx from "clsx";
import { tr } from "date-fns/locale";
import { twMerge } from "tailwind-merge";

function useClickOutside(ref, handler) {
  useEffect(() => {
    const listener = (event) => {
      if (!ref.current || ref.current.contains(event.target)) {
        return;
      }
      handler(event);
    };
    document.addEventListener("mousedown", listener);
    document.addEventListener("touchstart", listener);
    return () => {
      document.removeEventListener("mousedown", listener);
      document.removeEventListener("touchstart", listener);
    };
  }, [ref, handler]);
}

const ClockIcon = () => (
  <svg height="16" strokeLinejoin="round" viewBox="0 0 16 16" width="16">
    <path fillRule="evenodd" clipRule="evenodd" d="M14.5 8C14.5 11.5899 11.5899 14.5 8 14.5C4.41015 14.5 1.5 11.5899 1.5 8C1.5 4.41015 4.41015 1.5 8 1.5C11.5899 1.5 14.5 4.41015 14.5 8ZM16 8C16 12.4183 12.4183 16 8 16C3.58172 16 0 12.4183 0 8C0 3.58172 3.58172 0 8 0C12.4183 0 16 3.58172 16 8ZM8.75 4.75V4H7.25V4.75V7.875C7.25 8.18976 7.39819 8.48615 7.65 8.675L9.55 10.1L10.15 10.55L11.05 9.35L10.45 8.9L8.75 7.625V4.75Z" className="fill-slate-500" />
  </svg>
);

const ArrowBottomIcon = ({ className }) => (
  <svg height="16" strokeLinejoin="round" viewBox="0 0 16 16" width="16" className={clsx("fill-slate-500", className)}>
    <path fillRule="evenodd" clipRule="evenodd" d="M14.0607 5.49999L13.5303 6.03032L8.7071 10.8535C8.31658 11.2441 7.68341 11.2441 7.29289 10.8535L2.46966 6.03032L1.93933 5.49999L2.99999 4.43933L3.53032 4.96966L7.99999 9.43933L12.4697 4.96966L13 4.43933L14.0607 5.49999Z" />
  </svg>
);

const ArrowLeftIcon = () => (
  <svg height="16" strokeLinejoin="round" viewBox="0 0 16 16" width="16">
    <path fillRule="evenodd" clipRule="evenodd" d="M10.5 14.0607L9.96966 13.5303L5.14644 8.7071C4.75592 8.31658 4.75592 7.68341 5.14644 7.29289L9.96966 2.46966L10.5 1.93933L11.5607 2.99999L11.0303 3.53032L6.56065 7.99999L11.0303 12.4697L11.5607 13L10.5 14.0607Z" className="fill-slate-500" />
  </svg>
);

const ArrowRightIcon = () => (
  <svg height="16" strokeLinejoin="round" viewBox="0 0 16 16" width="16">
    <path fillRule="evenodd" clipRule="evenodd" d="M5.50001 1.93933L6.03034 2.46966L10.8536 7.29288C11.2441 7.68341 11.2441 8.31657 10.8536 8.7071L6.03034 13.5303L5.50001 14.0607L4.43935 13L4.96968 12.4697L9.43935 7.99999L4.96968 3.53032L4.43935 2.99999L5.50001 1.93933Z" className="fill-slate-500" />
  </svg>
);

const CalendarIcon = () => (
  <svg height="16" strokeLinejoin="round" viewBox="0 0 16 16" width="16" className="fill-slate-500">
    <path fillRule="evenodd" clipRule="evenodd" d="M5.5 0.5V1.25V2H10.5V1.25V0.5H12V1.25V2H14H15.5V3.5V13.5C15.5 14.8807 14.3807 16 13 16H3C1.61929 16 0.5 14.8807 0.5 13.5V3.5V2H2H4V1.25V0.5H5.5ZM2 3.5H14V6H2V3.5ZM2 7.5V13.5C2 14.0523 2.44772 14.5 3 14.5H13C13.5523 14.5 14 14.0523 14 13.5V7.5H2Z" />
  </svg>
);

const ClearIcon = () => (
  <svg height="16" strokeLinejoin="round" viewBox="0 0 16 16" width="16" className="fill-slate-400">
    <path fillRule="evenodd" clipRule="evenodd" d="M12.4697 13.5303L13 14.0607L14.0607 13L13.5303 12.4697L9.06065 7.99999L13.5303 3.53032L14.0607 2.99999L13 1.93933L12.4697 2.46966L7.99999 6.93933L3.53032 2.46966L2.99999 1.93933L1.93933 2.99999L2.46966 3.53032L6.93933 7.99999L2.46966 12.4697L1.93933 13L2.99999 14.0607L3.53032 13.5303L7.99999 9.06065L12.4697 13.5303Z" />
  </svg>
);

const parseRelativeDate = (input) => {
  const regex = /(\d+)\s*(gün|hafta|ay|yıl|saat)s?/i;
  const match = input.match(regex);
  if (!match) return null;
  const value = parseInt(match[1]);
  let unit = "";
  if (match[2].toLowerCase() === "gün") unit = "days";
  if (match[2].toLowerCase() === "hafta") unit = "weeks";
  if (match[2].toLowerCase() === "ay") unit = "months";
  if (match[2].toLowerCase() === "yıl") unit = "years";
  if (match[2].toLowerCase() === "saat") unit = "hours";
  if (!unit) return null;

  const now = new Date();
  const start = startOfDay(sub(now, { [unit]: value }));
  const end = endOfDay(now);
  return { [input]: { text: input, start, end } };
};

const parseFixedRange = (input) => {
  const rangePattern = /(.+)\s*[-–]\s*(.+)/;
  const match = input.match(rangePattern);
  if (!match) return parseExactDate(input);
  const [, startStr, endStr] = match;
  if (!startStr || !endStr) return null;

  const possibleFormats = ["d MMM yyyy", "d MMM", "yyyy-MM-dd", "dd.MM.yyyy"];
  for (const formatStr of possibleFormats) {
    const now = new Date();
    const year = now.getFullYear();
    const start = parse(startStr.trim(), formatStr, now, { locale: tr });
    const end = parse(endStr.trim(), formatStr, now, { locale: tr });

    const finalStart = isValid(start) ? startOfDay(start) : null;
    const finalEnd = isValid(end) ? endOfDay(end) : null;

    if (finalStart && finalEnd) {
      if (formatStr === "d MMM") {
        finalStart.setFullYear(year);
        finalEnd.setFullYear(year);
      }
      return { [input]: { text: input, start: finalStart, end: finalEnd } };
    }
  }
  return null;
};

const parseExactDate = (input) => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const dateFormats = ["d MMM yyyy", "d MMM", "yyyy-MM-dd", "dd.MM.yyyy"];

  for (const formatStr of dateFormats) {
    let date = parse(input.trim(), formatStr, now, { locale: tr });
    if (isValid(date)) {
      if (formatStr === "d MMM") date.setFullYear(currentYear);
      return { [input]: { text: input, start: startOfDay(date), end: endOfDay(date) } };
    }
  }
  return null;
};

const parseDateInput = (input) => {
  const relative = parseRelativeDate(input);
  if (relative) return relative;
  const fixedRange = parseFixedRange(input);
  if (fixedRange) return fixedRange;
  const exact = parseExactDate(input);
  if (exact) return exact;
  return null;
};

const filterPresets = (obj, search) => {
  if (!search) return obj;
  const searchWords = search.toLowerCase().split("-").filter(Boolean);
  const filtered = Object.fromEntries(
    Object.entries(obj).filter(([_, value]) => {
      const keyLower = value.text.toLowerCase();
      return searchWords.every(word => keyLower.includes(word));
    })
  );
  if (Object.keys(filtered).length > 0) return filtered;

  const parsed = parseDateInput(search);
  if (parsed) return parsed;

  const numberMatch = search.match(/\d+/);
  if (!numberMatch) return {};

  const n = parseInt(numberMatch[0], 10);
  const now = new Date();
  return {
    [`last-${n}-days`]: { text: `Son ${n} Gün`, start: startOfDay(subDays(now, n)), end: endOfDay(now) },
    [`last-${n}-weeks`]: { text: `Son ${n} Hafta`, start: startOfDay(subWeeks(now, n)), end: endOfDay(now) },
    [`last-${n}-months`]: { text: `Son ${n} Ay`, start: startOfDay(subMonths(now, n)), end: endOfDay(now) },
    [`last-${n}-years`]: { text: `Son ${n} Yıl`, start: startOfDay(subYears(now, n)), end: endOfDay(now) }
  };
};

const formatDateRange = (start, end, timezone) => {
  const isStartMidnight = isEqual(start, startOfDay(start));
  const isEndEOD = isEqual(end, endOfDay(end));
  const sameDay = isSameDay(start, end);

  const formatSingle = (date) => formatInTimeZone(date, timezone, isStartMidnight ? "d MMM" : "d MMM, HH:mm", { locale: tr });
  const formatMonth = (date) => formatInTimeZone(date, timezone, "MMM", { locale: tr });
  const formatDay = (date) => formatInTimeZone(date, timezone, "d", { locale: tr });
  const formatYear = (date) => formatInTimeZone(date, timezone, "yy", { locale: tr });

  const formatDateWithTimeIfNeeded = (date, showTime) => formatInTimeZone(date, timezone, showTime ? "d MMM, HH:mm" : "d MMM", { locale: tr });

  if (sameDay) return formatSingle(start);

  const sameMonth = formatMonth(start) === formatMonth(end) && formatYear(start) === formatYear(end);
  const sameYear = formatYear(start) === formatYear(end);

  const startHasTime = !isStartMidnight;
  const endHasTime = !isEndEOD;

  if (startHasTime || endHasTime) {
    const startFormatted = formatDateWithTimeIfNeeded(start, startHasTime);
    const endFormatted = formatDateWithTimeIfNeeded(end, endHasTime);
    return `${startFormatted} - ${endFormatted}`;
  }

  if (sameMonth) return `${formatDay(start)} - ${formatDay(end)} ${formatMonth(start)}`;
  if (sameYear) return `${formatDay(start)} ${formatMonth(start)} - ${formatDay(end)} ${formatMonth(end)}`;
  
  return `${formatDay(start)} ${formatMonth(start)} '${formatYear(start)} - ${formatDay(end)} ${formatMonth(end)} '${formatYear(end)}`;
};

const typeRelativeTimes = [
  { text: "45dk", start: subMinutes(new Date(), 45), end: new Date() },
  { text: "12 saat", start: subHours(new Date(), 12), end: new Date() },
  { text: "10g", start: startOfDay(subDays(new Date(), 10)), end: endOfDay(new Date()) },
  { text: "2 hafta", start: startOfDay(subWeeks(new Date(), 2)), end: endOfDay(new Date()) },
  { text: "geçen ay", start: startOfDay(subMonths(new Date(), 1)), end: endOfDay(new Date()) },
  { text: "dün", start: startOfDay(subDays(new Date(), 1)), end: endOfDay(subDays(new Date(), 1)) },
  { text: "bugün", start: startOfDay(new Date()), end: endOfDay(new Date()) }
];

const typeFixedTimes = [
  { text: "1 Oca", start: startOfDay(new Date(new Date().getFullYear(), 0, 1)), end: endOfDay(new Date(new Date().getFullYear(), 0, 1)) },
  { text: "1 Oca - 2 Oca", start: startOfDay(new Date(new Date().getFullYear(), 0, 1)), end: endOfDay(new Date(new Date().getFullYear(), 0, 2)) }
];

const CalendarCombobox = ({ stacked, compact, value, onChange, presets, presetIndex }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [currentPreset, setCurrentPreset] = useState(null);
  const ref = useRef(null);

  const onFocus = () => setIsOpen(true);
  const onChangeInputValue = (e) => setInputValue(e.target.value);
  const onClick = (val) => {
    setInputValue(val.text);
    setCurrentPreset(val);
    onChange({ start: val.start, end: val.end });
    setIsOpen(false);
  };

  const filteredPresets = filterPresets(presets, inputValue);
  useClickOutside(ref, () => setIsOpen(false));

  useEffect(() => {
    const array = Object.entries(presets);
    if (presetIndex !== undefined && presetIndex >= 0 && presetIndex < array.length) {
      setInputValue(array[presetIndex][1].text);
      setCurrentPreset(array[presetIndex][1]);
      onChange({ start: array[presetIndex][1].start, end: array[presetIndex][1].end });
    }
  }, [presetIndex, presets]); // added presets dependency to ensure translations

  useEffect(() => {
    if (currentPreset && (currentPreset.start !== value?.start || currentPreset.end !== value?.end)) {
      setCurrentPreset(null);
      setInputValue("");
    }
  }, [value]);

  return (
    <div
      ref={ref}
      className={twMerge(clsx(
        "inline-block text-sm font-sans z-50",
        compact ? "w-[180px] absolute left-[38px]" : "w-[250px] relative",
      ))}
    >
      <div className="relative flex items-center">
        {!compact && <div className="absolute left-3 pt-1"><ClockIcon /></div>}
        <input
          type="text"
          placeholder="Dönem Seç"
          onFocus={onFocus}
          value={inputValue}
          onChange={onChangeInputValue}
          className={clsx(
            "w-full bg-white border border-slate-200 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm py-2 px-3 text-slate-700",
            compact ? "rounded-lg" : "rounded-lg pl-9",
            stacked && !compact && "rounded-b-none",
            !stacked && !compact && "rounded-r-none"
          )}
        />
        <div className="absolute right-3 cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
          <ArrowBottomIcon className={clsx("duration-200", isOpen && "rotate-180")} />
        </div>
      </div>
      
      {isOpen && (
        <div className={clsx(
          "absolute z-50 top-11 left-0 bg-white border border-slate-200 rounded-lg shadow-xl",
          compact ? "w-full" : "w-[400px] flex"
        )}>
          <ul className="p-2 border-r border-r-slate-100 flex-1 h-64 overflow-y-auto">
            {Object.keys(filteredPresets).length > 0 ? Object.entries(filteredPresets).map(([key, val]) => (
              <li
                key={key}
                className="flex items-center cursor-pointer px-3 py-2 rounded-md hover:bg-slate-50 transition-colors text-sm text-slate-700"
                onClick={() => onClick(val)}
              >
                {val.text}
              </li>
            )) : (
              <li className="px-3 py-2 text-sm text-slate-500 text-center">Bulunamadı</li>
            )}
          </ul>
          {!compact && (
            <div className="p-4 flex-1">
              <div className="text-sm font-medium text-slate-800 mb-2">Hızlı süre girin</div>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {typeRelativeTimes.map((val) => (
                  <button key={val.text} onClick={() => onClick(val)} className="text-[12px] bg-slate-100 text-slate-600 px-2 py-1 rounded hover:bg-slate-200">
                    {val.text}
                  </button>
                ))}
              </div>
              <div className="text-sm font-medium text-slate-800 mb-2">Belirli tarihler girin</div>
              <div className="flex flex-wrap gap-1.5">
                {typeFixedTimes.map((val) => (
                  <button key={val.text} onClick={() => onClick(val)} className="text-[12px] bg-slate-100 text-slate-600 px-2 py-1 rounded hover:bg-slate-200">
                    {val.text}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const DatePicker = ({
  allowClear = true,
  compact = false,
  stacked = false,
  horizontalLayout = true,
  showTimeInput = false,
  value,
  onChange,
  presets,
  presetIndex,
  minValue,
  maxValue,
  renderTrigger,
  popupAlignment = "bottom",
  hideApplyButton = false,
  viewOnly = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [hoverDate, setHoverDate] = useState(null);
  const [isSelecting, setIsSelecting] = useState(false);

  const timezones = useMemo(() => ([
    { value: "UTC", label: "UTC" },
    { value: Intl.DateTimeFormat().resolvedOptions().timeZone, label: `Yerel (${Intl.DateTimeFormat().resolvedOptions().timeZone})` }
  ]), []);
  const [selectedTimezone, setSelectedTimezone] = useState(timezones[1].value);

  const [startDateStr, setStartDateStr] = useState(formatInTimeZone(value?.start || new Date(), selectedTimezone, "dd MMM yyyy", { locale: tr }));
  const [startTimeStr, setStartTimeStr] = useState(formatInTimeZone(startOfDay(value?.start || new Date()), selectedTimezone, "HH:mm", { locale: tr }));
  const [endDateStr, setEndDateStr] = useState(formatInTimeZone(value?.end || new Date(), selectedTimezone, "dd MMM yyyy", { locale: tr }));
  const [endTimeStr, setEndTimeStr] = useState(formatInTimeZone(endOfDay(value?.end || new Date()), selectedTimezone, "HH:mm", { locale: tr }));

  const calendarRef = useRef(null);

  useClickOutside(calendarRef, () => setIsOpen(false));

  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));

  let daysArray = [];
  let day = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 });
  while (day <= endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 })) {
    daysArray.push(day);
    day = addDays(day, 1);
  }

  const handleDateClick = (clickedDay) => {
    if (!value?.start || (value.start && value.end)) {
      onChange({ start: startOfDay(clickedDay), end: null });
      setHoverDate(clickedDay);
      setIsSelecting(true);
    } else if (isSelecting) {
      if (clickedDay > value.start) {
        onChange({ ...value, end: endOfDay(clickedDay) });
      } else {
        onChange({ start: startOfDay(clickedDay), end: endOfDay(value.start) });
      }
      setIsSelecting(false);
      setHoverDate(null);
      // setIsOpen(false); // Let user click Apply
    }
  };

  const handleMouseEnter = (d) => {
    if (value?.start && !value.end) {
      setHoverDate(d);
    }
  };

  const onApply = () => {
    const pStart = parse(startDateStr, "dd MMM yyyy", new Date(), { locale: tr });
    const pEnd = parse(endDateStr, "dd MMM yyyy", new Date(), { locale: tr });
    
    if (isValid(pStart) && isValid(pEnd)) {
        onChange({
            start: startOfDay(pStart),
            end: endOfDay(pEnd)
        });
        setIsOpen(false);
    }
  };

  useEffect(() => {
    setStartDateStr(formatInTimeZone(value?.start || new Date(), selectedTimezone, "dd MMM yyyy", { locale: tr }));
    setEndDateStr(formatInTimeZone(value?.end || new Date(), selectedTimezone, "dd MMM yyyy", { locale: tr }));
  }, [isOpen, value, selectedTimezone]);

  return (
    <div className="relative block z-40">
      <div className={clsx(presets && "flex items-stretch", presets && stacked && "flex-col", false && "w-[220px]")}>
        {presets && (
          <CalendarCombobox
            stacked={stacked}
            compact={compact}
            presets={presets}
            value={value}
            onChange={onChange}
            presetIndex={presetIndex}
          />
        )}
        <div className="relative flex items-center">
          {renderTrigger ? (
             renderTrigger({ isOpen, setIsOpen, value, selectedTimezone })
          ) : (
            <>
              <button
                className={clsx(
                  "flex items-center gap-2 bg-white border border-slate-200 outline-none text-sm py-2 px-3 text-slate-700 hover:bg-slate-50 transition-colors",
                  !presets && "rounded-lg",
                  presets && !stacked && !compact && "rounded-r-lg border-l-0",
                  "w-[250px]"
                )}
                onClick={() => setIsOpen(!isOpen)}
              >
                <CalendarIcon />
                <span className="truncate flex-1 text-left">
                  {value?.start && value?.end ? formatDateRange(value.start, value.end, selectedTimezone) : "Tarih Aralığı Seç"}
                </span>
              </button>
              
              {value?.start && value?.end && allowClear && (
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 rounded-full text-slate-400"
                  onClick={(e) => { e.stopPropagation(); onChange(null); setIsOpen(false); }}
                >
                  <ClearIcon />
                </button>
              )}
            </>
          )}
        </div>
      </div>
      
      {isOpen && (
        <div 
          ref={calendarRef}
          className={clsx(
            "absolute z-50 bg-white rounded-lg shadow-xl border border-slate-200 p-4 font-sans w-[280px]",
            popupAlignment === "right" ? "top-0 left-full ml-2" : popupAlignment === "top" ? "bottom-full left-0 mb-2" : "top-full left-0 mt-2"
          )}
        >
          <div className="flex flex-col">
            <div className="flex-1">
              <div className="flex justify-between items-center mb-4">
                <button onClick={prevMonth} className="p-1 hover:bg-slate-100 rounded"><ArrowLeftIcon /></button>
                <div className="text-sm font-semibold text-slate-800">
                  {formatInTimeZone(currentDate, selectedTimezone, "MMMM yyyy", { locale: tr })}
                </div>
                <button onClick={nextMonth} className="p-1 hover:bg-slate-100 rounded"><ArrowRightIcon /></button>
              </div>
              <div className="grid grid-cols-7 text-center text-xs font-semibold text-slate-400 mb-2">
                <div>Pzt</div><div>Sal</div><div>Çar</div><div>Per</div><div>Cum</div><div>Cmt</div><div>Paz</div>
              </div>
              <div className="grid grid-cols-7 gap-y-1">
                {daysArray.map((d) => {
                  const isStart = value?.start && isSameDay(d, value.start);
                  const isEnd = value?.end && isSameDay(d, value.end);
                  const currentHover = hoverDate && isSelecting && isSameDay(d, hoverDate);
                  const isInRange = value?.start && ((value.end && isWithinInterval(d, { start: value.start, end: value.end })) || (hoverDate && isWithinInterval(d, { start: value.start, end: hoverDate })));
                  const isAllowed = (minValue ? d >= minValue : true) && (maxValue ? d <= maxValue : true);

                  return (
                    <div
                      key={d.toString()}
                      className={clsx(
                        "flex items-center justify-center text-sm h-8",
                        isInRange && !isStart && !isEnd && !currentHover && !viewOnly && "bg-emerald-50",
                        isAllowed && !viewOnly ? "cursor-pointer" : "cursor-default",
                        !isSameMonth(d, currentDate) && "opacity-40"
                      )}
                      onMouseEnter={() => isAllowed && !viewOnly && handleMouseEnter(d)}
                      onClick={() => isAllowed && !viewOnly && handleDateClick(d)}
                    >
                      <div className={clsx(
                        "w-7 h-7 flex items-center justify-center rounded-full transition-colors",
                        (isStart || isEnd || currentHover) && !viewOnly && "bg-emerald-600 text-white font-semibold",
                        viewOnly && isToday(d) && "bg-[#5da83f] text-white font-semibold",
                        !isStart && !isEnd && !currentHover && isToday(d) && !viewOnly && "bg-slate-100 text-emerald-600 font-bold",
                        !isStart && !isEnd && !currentHover && !isToday(d) && !viewOnly && "hover:bg-slate-100"
                      )}>
                        {format(d, "d")}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {!hideApplyButton && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <button
                  onClick={() => { onChange({ start: value?.start || new Date(), end: value?.end || new Date() }); setIsOpen(false); }}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  Uygula
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
