"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"

interface TimePickerProps {
  value?: string // Format: "HH:mm"
  onChange?: (value: string) => void
  disabled?: boolean
  className?: string
  minTime?: string // Format: "HH:mm"
  maxTime?: string // Format: "HH:mm"
}

export function TimePicker({
  value,
  onChange,
  disabled = false,
  className,
  minTime,
  maxTime,
}: TimePickerProps) {
  const [hours, setHours] = React.useState(value?.split(":")[0] || "")
  const [minutes, setMinutes] = React.useState(value?.split(":")[1] || "")

  const hourRef = React.useRef<HTMLInputElement>(null)
  const minuteRef = React.useRef<HTMLInputElement>(null)

  // Update internal state when value changes
  React.useEffect(() => {
    if (value) {
      const [h, m] = value.split(":")
      setHours(h)
      setMinutes(m)
    }
  }, [value])

  const handleTimeChange = (newHours: string, newMinutes: string) => {
    // Only call onChange if both values are valid
    if (newHours.length === 2 && newMinutes.length === 2) {
      const newTime = `${newHours}:${newMinutes}`

      // Validate against min/max time
      if (minTime && newTime < minTime) return
      if (maxTime && newTime > maxTime) return

      onChange?.(newTime)
    }
  }

  const handleHourChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, "") // Remove non-digits

    // Limit to 2 digits
    if (val.length > 2) val = val.slice(0, 2)

    // Auto-correct invalid hours
    if (val.length === 2) {
      const num = parseInt(val)
      if (num > 23) val = "23"
    }

    // Auto-format single digit if user types a number > 2
    if (val.length === 1 && parseInt(val) > 2) {
      val = "0" + val
    }

    setHours(val)

    // Auto-jump to minutes when hour is complete
    if (val.length === 2) {
      minuteRef.current?.focus()
      minuteRef.current?.select()
    }

    // Update value if both are complete
    if (val.length === 2 && minutes.length === 2) {
      handleTimeChange(val, minutes)
    }
  }

  const handleMinuteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, "") // Remove non-digits

    // Limit to 2 digits
    if (val.length > 2) val = val.slice(0, 2)

    // Auto-correct invalid minutes
    if (val.length === 2) {
      const num = parseInt(val)
      if (num > 59) val = "59"
    }

    // Auto-format single digit if user types a number > 5
    if (val.length === 1 && parseInt(val) > 5) {
      val = "0" + val
    }

    setMinutes(val)

    // Update value if both are complete
    if (hours.length === 2 && val.length === 2) {
      handleTimeChange(hours, val)
    }
  }

  const handleHourBlur = () => {
    // Pad with leading zero if only 1 digit
    if (hours.length === 1) {
      const padded = hours.padStart(2, "0")
      setHours(padded)
      if (minutes.length === 2) {
        handleTimeChange(padded, minutes)
      }
    }
  }

  const handleMinuteBlur = () => {
    // Pad with leading zero if only 1 digit
    if (minutes.length === 1) {
      const padded = minutes.padStart(2, "0")
      setMinutes(padded)
      if (hours.length === 2) {
        handleTimeChange(hours, padded)
      }
    }
  }

  const handleHourKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Move to minutes on colon or arrow right
    if (e.key === ":" || e.key === "ArrowRight") {
      e.preventDefault()
      minuteRef.current?.focus()
      minuteRef.current?.select()
    }
  }

  const handleMinuteKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Move back to hours on arrow left (if at start)
    if (e.key === "ArrowLeft" && minuteRef.current?.selectionStart === 0) {
      e.preventDefault()
      hourRef.current?.focus()
      hourRef.current?.select()
    }
  }

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Input
        ref={hourRef}
        type="text"
        inputMode="numeric"
        placeholder="HH"
        value={hours}
        onChange={handleHourChange}
        onBlur={handleHourBlur}
        onKeyDown={handleHourKeyDown}
        disabled={disabled}
        className="w-16 text-center font-mono text-lg"
        maxLength={2}
      />
      <span className="text-xl sm:text-2xl font-bold">:</span>
      <Input
        ref={minuteRef}
        type="text"
        inputMode="numeric"
        placeholder="MM"
        value={minutes}
        onChange={handleMinuteChange}
        onBlur={handleMinuteBlur}
        onKeyDown={handleMinuteKeyDown}
        disabled={disabled}
        className="w-16 text-center font-mono text-lg"
        maxLength={2}
      />
    </div>
  )
}
