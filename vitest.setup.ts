import { configure } from '@testing-library/react'

// Las pruebas de pantalla esperan respuestas simuladas encadenadas: con toda la suite y la cobertura
// en paralelo, 1 s (el valor por defecto de findBy/waitFor) se queda corto.
configure({ asyncUtilTimeout: 5_000 })
