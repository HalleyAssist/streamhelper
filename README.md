# streamhelper
Stream Reader and Writers that provide a useful promise based API for consumption of stream data

Goals:
 - All promises should be cancellable from their .cancel method (compatible with q-lite safeRace)
 - Methods should be helpful and aligned to common patterns
 - No memory leaks from event emitters left attached to streams
