import { toast } from "sonner"

const useCustomToast = () => {
  const showSuccessToast = (description: string) => {
    toast.success("Success!", {
      description,
    })
  }

  const showErrorToast = (description: string, error?: any) => {
    const errorDetail =
      error?.body?.detail ||
      error?.message ||
      error?.detail ||
      (typeof error === "string" ? error : undefined)
    toast.error(description, {
      description: errorDetail,
    })
  }

  return { showSuccessToast, showErrorToast }
}

export default useCustomToast
