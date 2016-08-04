import org.viz.lightning._

val lgn = Lightning()

val r = scala.util.Random
val points = (0 to 10).map(i => Array(i + r.nextDouble - 0.5, i + r.nextDouble - 0.5)) // y = x + noise

lgn.plot("scatter-regression", Map("points" -> points))
